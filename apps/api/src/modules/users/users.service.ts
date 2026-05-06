import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';

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
