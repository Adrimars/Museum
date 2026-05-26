import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
        const parsed = JSON.parse(
          Buffer.from(dto.cursor, 'base64').toString('utf8'),
        ) as { createdAt: string; id: string };
        const date = new Date(parsed.createdAt);
        if (parsed.id && !isNaN(date.getTime())) {
          cursorPayload = parsed;
        }
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

  // ── PATCH /users/:id/role (museum_admin own | super_admin any) ─────────────

  async assignRole(
    targetId: string,
    actorId: string,
    // S-6: actor role + museumId required so we can enforce museum_admin scope
    actorRole: string,
    actorMuseumId: string | null,
    dto: AssignRoleDto,
  ) {
    // Prevent self-role changes to avoid accidental lockout
    if (targetId === actorId) {
      throw new BadRequestException({
        message: 'You cannot change your own role.',
        errorCode: ErrorCode.USER_ROLE_ESCALATION_FORBIDDEN,
      });
    }

    // S-6: museum_admin may only assign museum_admin or content_editor (per PRD §7.2 + Design Query 6.1)
    if (actorRole === 'museum_admin') {
      const allowedRoles: string[] = ['museum_admin', 'content_editor'];
      if (!allowedRoles.includes(dto.role)) {
        throw new ForbiddenException({
          message: `museum_admin can only assign the roles: ${allowedRoles.join(', ')}.`,
          errorCode: ErrorCode.FORBIDDEN,
        });
      }
      // museum_admin must target their own museum and cannot omit museumId
      if (!dto.museumId || dto.museumId !== actorMuseumId) {
        throw new ForbiddenException({
          message: 'You can only assign roles within your own museum.',
          errorCode: ErrorCode.FORBIDDEN,
        });
      }
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
    // S-5: actor now carries museumId so museum_admin scope can be enforced
    actor: { id: string; role: string; museumId?: string | null },
    dto: BanUserDto,
    ipAddress: string,
  ) {
    const target = await this.prisma.user.findFirst({
      where: { id: targetId, deletedAt: null },
      select: { id: true, isBanned: true, museumId: true },
    });

    if (!target) {
      throw new NotFoundException({
        message: 'User not found.',
        errorCode: ErrorCode.USER_NOT_FOUND,
      });
    }

    // S-5: museum_admin may only ban users who belong to their own museum
    if (actor.role === 'museum_admin' && target.museumId !== actor.museumId) {
      throw new ForbiddenException({
        message: 'You can only ban users within your own museum.',
        errorCode: ErrorCode.FORBIDDEN,
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
    // S-5: symmetric scope check for unban
    actor: { id: string; role: string; museumId?: string | null },
    ipAddress: string,
  ) {
    const target = await this.prisma.user.findFirst({
      where: { id: targetId, deletedAt: null },
      select: { id: true, isBanned: true, museumId: true },
    });

    if (!target) {
      throw new NotFoundException({
        message: 'User not found.',
        errorCode: ErrorCode.USER_NOT_FOUND,
      });
    }

    // S-5: museum_admin may only unban users who belong to their own museum
    if (actor.role === 'museum_admin' && target.museumId !== actor.museumId) {
      throw new ForbiddenException({
        message: 'You can only unban users within your own museum.',
        errorCode: ErrorCode.FORBIDDEN,
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
