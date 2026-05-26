import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma, RewardType } from '@prisma/client';
import * as crypto from 'crypto';

import { ErrorCode } from '../../common/errors/error-codes';
import { ApiException } from '../../common/exceptions/api.exception';
import { PrismaService } from '../../prisma/prisma.service';

import type { CreateRewardDto } from './dto/create-reward.dto';
import type { IssueRewardDto } from './dto/issue-reward.dto';
import type { UpdateRewardDto } from './dto/update-reward.dto';
import type { VerifyDiscountDto } from './dto/verify-discount.dto';

const DISCOUNT_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const DISCOUNT_CODE_LENGTH = 8;
const MAX_CODE_RETRIES = 10;

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Reward Definitions CRUD (S6-07) ───────────────────────────────────────

  async createReward(dto: CreateRewardDto) {
    return this.prisma.reward.create({
      data: {
        museumId: dto.museumId,
        name: dto.name,
        type: dto.type,
        assetUrl: dto.assetUrl ?? null,
        description: dto.description ?? null,
        triggerType: dto.triggerType,
        triggerConfig: (dto.triggerConfig ?? {}) as object,
        linkedScenarioId: dto.linkedScenarioId ?? null,
        discountValidityDays: dto.discountValidityDays ?? null,
      },
    });
  }

  async listRewards(museumId: string) {
    return this.prisma.reward.findMany({
      where: { museumId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateReward(id: string, dto: UpdateRewardDto) {
    const reward = await this.prisma.reward.findFirst({ where: { id, deletedAt: null } });
    if (!reward) {
      throw new ApiException('Reward not found.', ErrorCode.REWARD_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return this.prisma.reward.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.assetUrl !== undefined && { assetUrl: dto.assetUrl }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.triggerConfig !== undefined && { triggerConfig: dto.triggerConfig as object }),
        ...(dto.linkedScenarioId !== undefined && { linkedScenarioId: dto.linkedScenarioId }),
        ...(dto.discountValidityDays !== undefined && { discountValidityDays: dto.discountValidityDays }),
      },
    });
  }

  async deleteReward(id: string) {
    const reward = await this.prisma.reward.findFirst({ where: { id, deletedAt: null } });
    if (!reward) {
      throw new ApiException('Reward not found.', ErrorCode.REWARD_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    await this.prisma.reward.update({ where: { id }, data: { deletedAt: new Date() } });
    return { deleted: true };
  }

  // ── Reward Issuance (S6-07/S6-08) ────────────────────────────────────────

  async issueReward(dto: IssueRewardDto): Promise<{ userRewardId: string; discountCode: string | null }> {
    const reward = await this.prisma.reward.findFirst({
      where: { id: dto.rewardId, deletedAt: null },
    });
    if (!reward) {
      throw new ApiException('Reward not found.', ErrorCode.REWARD_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    // Generate discount code if applicable (S6-08) — done before the create so we don't
    // hold a half-written row on collision
    let discountCode: string | null = null;
    if (reward.type === RewardType.discount_code) {
      discountCode = await this.generateUniqueDiscountCode();
    }

    const expiresAt = reward.discountValidityDays
      ? new Date(Date.now() + reward.discountValidityDays * 86_400_000)
      : null;

    try {
      // S-4: removed pre-flight findFirst + separate create (TOCTOU window).
      // The DB unique constraint @@unique([userId, rewardId]) is the single source of truth;
      // concurrent requests both racing past a findFirst check would produce an unhandled 500.
      const userReward = await this.prisma.userReward.create({
        data: {
          userId: dto.userId,
          rewardId: dto.rewardId,
          discountCode,
          isRedeemed: false,
          earnedVia: (dto.earnedVia ?? {}) as object,
          expiresAt,
        },
      });

      this.logger.log(`Reward issued: rewardId=${dto.rewardId} userId=${dto.userId} type=${reward.type}`);
      return { userRewardId: userReward.id, discountCode };
    } catch (err) {
      // S-4: P2002 = unique violation — race-safe duplicate detection returns clean 409
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ApiException(
          'Reward already issued to this user.',
          ErrorCode.REWARD_ALREADY_ISSUED,
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  // ── Discount Code Verification (S6-09) ────────────────────────────────────

  async verifyDiscount(rewardId: string, dto: VerifyDiscountDto) {
    const reward = await this.prisma.reward.findFirst({ where: { id: rewardId, deletedAt: null } });
    if (!reward) {
      throw new ApiException('Reward not found.', ErrorCode.REWARD_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    if (reward.type !== RewardType.discount_code) {
      throw new ApiException(
        'This reward is not a discount code.',
        ErrorCode.REWARD_NOT_DISCOUNT_TYPE,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const userReward = await this.prisma.userReward.findFirst({
      where: { rewardId, discountCode: dto.code },
    });
    if (!userReward) {
      throw new ApiException('Discount code is invalid.', ErrorCode.REWARD_CODE_INVALID, HttpStatus.NOT_FOUND);
    }
    if (userReward.isRedeemed) {
      throw new ApiException('Discount code has already been redeemed.', ErrorCode.REWARD_CODE_REDEEMED, HttpStatus.GONE);
    }
    if (userReward.expiresAt && userReward.expiresAt < new Date()) {
      throw new ApiException('Discount code has expired.', ErrorCode.REWARD_CODE_INVALID, HttpStatus.GONE);
    }

    await this.prisma.userReward.update({
      where: { id: userReward.id },
      data: { isRedeemed: true },
    });

    this.logger.log(`Discount code redeemed: code=${dto.code} rewardId=${rewardId}`);
    return { valid: true, redeemed: true, userId: userReward.userId };
  }

  // ── User Rewards (called from UsersModule) ────────────────────────────────

  async getUserRewards(userId: string) {
    return this.prisma.userReward.findMany({
      where: { userId },
      include: { reward: { select: { name: true, type: true, assetUrl: true, description: true } } },
      orderBy: { issuedAt: 'desc' },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private generateDiscountCode(): string {
    const bytes = crypto.randomBytes(DISCOUNT_CODE_LENGTH);
    return Array.from(bytes)
      .map((b) => DISCOUNT_CHARSET[b % DISCOUNT_CHARSET.length])
      .join('');
  }

  private async generateUniqueDiscountCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
      const code = this.generateDiscountCode();
      const collision = await this.prisma.userReward.findFirst({ where: { discountCode: code } });
      if (!collision) return code;
    }
    throw new ApiException(
      'Failed to generate a unique discount code after retries.',
      ErrorCode.INTERNAL_ERROR,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
