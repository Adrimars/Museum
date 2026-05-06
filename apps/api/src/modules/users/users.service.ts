import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

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
}
