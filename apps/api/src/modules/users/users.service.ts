import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../auth/token.service';

import type { AssignRoleDto } from './dto/assign-role.dto';
import type { BanUserDto } from './dto/ban-user.dto';
import type { ListUsersDto } from './dto/list-users.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';

// Fields safe to return — never expose passwordHash or deletedAt
const USER_SAFE_SELECT = {
  id: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  role: true,
  museumId: true,
  totalPoints: true,
  preferences: true,
  dateOfBirth: true,
  isBanned: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  // ── GET /me ─────────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: USER_SAFE_SELECT,
    });

    if (!user) {
      throw new NotFoundException({
        message: 'User not found.',
        errorCode: ErrorCode.USER_NOT_FOUND,
      });
    }

    return user;
  }

  // ── GET /users (admin listing) ──────────────────────────────────────────

  async findAll(dto: ListUsersDto, actorRole: string, actorMuseumId: string | null) {
    const limit = dto.limit ?? 20;

    // museum_admin is always scoped to their own museum — ignore any museumId query param
    const scopedMuseumId =
      actorRole === 'museum_admin' ? actorMuseumId : (dto.museumId ?? undefined);

    let cursorPayload: { createdAt: string; id: string } | null = null;
    if (dto.cursor) {
      try {
        cursorPayload = JSON.parse(
          Buffer.from(dto.cursor, 'base64').toString('utf8'),
        ) as { createdAt: string; id: string };
      } catch {
        cursorPayload = null;
      }
    }

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(scopedMuseumId !== undefined && { museumId: scopedMuseumId }),
      ...(dto.role !== undefined && { role: dto.role as Prisma.EnumUserRoleFilter }),
      ...(dto.isBanned !== undefined && { isBanned: dto.isBanned }),
      ...(dto.search !== undefined && {
        OR: [
          { displayName: { contains: dto.search, mode: 'insensitive' } },
          { email: { contains: dto.search, mode: 'insensitive' } },
        ],
      }),
      ...(cursorPayload && {
        OR: [
          { createdAt: { gt: new Date(cursorPayload.createdAt) } },
          {
            createdAt: { equals: new Date(cursorPayload.createdAt) },
            id: { gt: cursorPayload.id },
          },
        ],
      }),
    };

    const users = await this.prisma.user.findMany({
      where,
      select: USER_SAFE_SELECT,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });

    const hasMore = users.length > limit;
    const items = hasMore ? users.slice(0, limit) : users;
    const lastItem = items.at(-1);

    const nextCursor =
      hasMore && lastItem
        ? Buffer.from(
            JSON.stringify({ createdAt: lastItem.createdAt.toISOString(), id: lastItem.id }),
          ).toString('base64')
        : null;

    return { data: items, cursor: nextCursor, hasMore };
  }

  // ── PATCH /me ────────────────────────────────────────────────────────────

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, preferences: true },
    });

    if (!user) {
      throw new NotFoundException({
        message: 'User not found.',
        errorCode: ErrorCode.USER_NOT_FOUND,
      });
    }

    // Merge incoming preferences with existing — don't wipe unset keys
    const mergedPreferences =
      dto.preferences !== undefined
        ? { ...(user.preferences as object), ...dto.preferences }
        : undefined;

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
        ...(mergedPreferences !== undefined && { preferences: mergedPreferences as Prisma.InputJsonValue }),
      },
      select: USER_SAFE_SELECT,
    });
  }

  // ── PATCH /users/:id/role (super_admin only) ─────────────────────────────

  async assignRole(targetId: string, actorId: string, dto: AssignRoleDto) {
    // Prevent self-role changes to avoid accidental lockout
    if (targetId === actorId) {
      throw new BadRequestException({
        message: 'You cannot change your own role.',
        errorCode: ErrorCode.USER_ROLE_ESCALATION_FORBIDDEN,
      });
    }

    const target = await this.prisma.user.findFirst({
      where: { id: targetId, deletedAt: null },
      select: { id: true },
    });

    if (!target) {
      throw new NotFoundException({
        message: 'User not found.',
        errorCode: ErrorCode.USER_NOT_FOUND,
      });
    }

    // museumId required for museum_admin / content_editor; cleared for user
    const requiresMuseum = dto.role === 'museum_admin' || dto.role === 'content_editor';

    if (requiresMuseum && !dto.museumId) {
      throw new BadRequestException({
        message: `museumId is required when assigning role "${dto.role}".`,
        errorCode: ErrorCode.VALIDATION_ERROR,
      });
    }

    if (requiresMuseum && dto.museumId) {
      const museum = await this.prisma.museum.findFirst({
        where: { id: dto.museumId, deletedAt: null },
        select: { id: true },
      });

      if (!museum) {
        throw new NotFoundException({
          message: 'Museum not found.',
          errorCode: ErrorCode.MUSEUM_NOT_FOUND,
        });
      }
    }

    return this.prisma.user.update({
      where: { id: targetId },
      data: {
        role: dto.role,
        museumId: requiresMuseum ? (dto.museumId ?? null) : null,
      },
      select: USER_SAFE_SELECT,
    });
  }

  // ── POST /users/:id/ban ──────────────────────────────────────────────────

  async banUser(
    targetId: string,
    actor: { id: string; role: string },
    dto: BanUserDto,
    ipAddress: string,
  ) {
    const target = await this.prisma.user.findFirst({
      where: { id: targetId, deletedAt: null },
      select: { id: true, isBanned: true },
    });

    if (!target) {
      throw new NotFoundException({
        message: 'User not found.',
        errorCode: ErrorCode.USER_NOT_FOUND,
      });
    }

    if (target.isBanned) {
      throw new BadRequestException({
        message: 'User is already banned.',
        errorCode: ErrorCode.VALIDATION_ERROR,
      });
    }

    // Revoke all active tokens — blocks Redis JTIs + marks DB rows revoked
    await this.tokenService.revokeAllUserRefreshTokens(targetId);

    const [user] = await Promise.all([
      this.prisma.user.update({
        where: { id: targetId },
        data: { isBanned: true },
        select: USER_SAFE_SELECT,
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'USER_BANNED',
          targetType: 'user',
          targetId,
          museumId: null,
          metadata: { reason: dto.reason ?? null },
          ipAddress,
        },
      }),
    ]);

    return user;
  }

  // ── DELETE /users/:id/ban ────────────────────────────────────────────────

  async unbanUser(
    targetId: string,
    actor: { id: string; role: string },
    ipAddress: string,
  ) {
    const target = await this.prisma.user.findFirst({
      where: { id: targetId, deletedAt: null },
      select: { id: true, isBanned: true },
    });

    if (!target) {
      throw new NotFoundException({
        message: 'User not found.',
        errorCode: ErrorCode.USER_NOT_FOUND,
      });
    }

    if (!target.isBanned) {
      throw new BadRequestException({
        message: 'User is not banned.',
        errorCode: ErrorCode.VALIDATION_ERROR,
      });
    }

    const [user] = await Promise.all([
      this.prisma.user.update({
        where: { id: targetId },
        data: { isBanned: false },
        select: USER_SAFE_SELECT,
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'USER_UNBANNED',
          targetType: 'user',
          targetId,
          museumId: null,
          metadata: {},
          ipAddress,
        },
      }),
    ]);

    return user;
  }
}
