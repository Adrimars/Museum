import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

import { REDIS_CLIENT } from '../../redis/redis.module';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtAccessPayload {
  sub: string;
  role: string;
  museumId: string | null;
}

export interface RefreshTokenResult {
  rawToken: string;
  jti: string;
  expiresAt: Date;
  tokenHash: string;
}

@Injectable()
export class TokenService {
  private readonly refreshExpiryMs: number;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {
    // Parse "7d" → ms
    const expiry = this.config.get<string>('auth.jwtRefreshExpiry', '7d');
    this.refreshExpiryMs = this.parseDurationMs(expiry);
  }

  issueAccessToken(payload: JwtAccessPayload): string {
    return this.jwt.sign(payload);
  }

  async issueRefreshToken(userId: string, deviceHint?: string): Promise<RefreshTokenResult> {
    // Revoke all previous refresh tokens for this user (1 active device limit)
    await this.revokeAllUserRefreshTokens(userId);

    const jti = uuidv4();
    const rawToken = randomBytes(64).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + this.refreshExpiryMs);

    await this.prisma.refreshToken.create({
      data: {
        jti,
        userId,
        tokenHash,
        deviceHint: deviceHint?.slice(0, 255),
        expiresAt,
        isRevoked: false,
      },
    });

    return { rawToken, jti, expiresAt, tokenHash };
  }

  async validateRefreshToken(
    rawToken: string,
  ): Promise<{ userId: string; jti: string } | null> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const record = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, isRevoked: false },
    });

    if (!record) return null;
    if (record.expiresAt < new Date()) return null;

    // Check Redis blocklist
    const blocked = await this.redis.get(`blocklist:jti:${record.jti}`);
    if (blocked) return null;

    return { userId: record.userId, jti: record.jti };
  }

  async rotateRefreshToken(
    oldJti: string,
    userId: string,
    deviceHint?: string,
  ): Promise<RefreshTokenResult> {
    // Block the old jti in Redis
    await this.blockJti(oldJti);

    // Revoke in DB
    await this.prisma.refreshToken.update({
      where: { jti: oldJti },
      data: { isRevoked: true },
    });

    return this.issueRefreshToken(userId, deviceHint);
  }

  async revokeRefreshToken(jti: string): Promise<void> {
    await Promise.all([
      this.blockJti(jti),
      this.prisma.refreshToken.update({
        where: { jti },
        data: { isRevoked: true },
      }).catch(() => undefined),
    ]);
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId, isRevoked: false },
      select: { jti: true },
    });

    await Promise.all([
      ...tokens.map((t) => this.blockJti(t.jti)),
      this.prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true },
      }),
    ]);
  }

  private async blockJti(jti: string): Promise<void> {
    const remainingTtlSec = Math.ceil(this.refreshExpiryMs / 1000);
    await this.redis.set(`blocklist:jti:${jti}`, '1', 'EX', remainingTtlSec);
  }

  private parseDurationMs(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = parseInt(match[1] ?? '7', 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return value * (multipliers[unit ?? 'd'] ?? 24 * 60 * 60 * 1000);
  }
}
