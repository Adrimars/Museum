import { createHash, randomBytes } from 'crypto';

import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { createTransport } from 'nodemailer';

import { ErrorCode } from '../../common/errors/error-codes';
import { ApiException } from '../../common/exceptions/api.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';

import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import { TokenService } from './token.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  // ── Register ──────────────────────────────────────────────────────────────

  async register(dto: RegisterDto, deviceHint?: string): Promise<AuthTokens> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ApiException(
        'An account with this email already exists.',
        ErrorCode.AUTH_EMAIL_EXISTS,
        HttpStatus.CONFLICT,
      );
    }

    const bcryptCost = this.config.get<number>('auth.bcryptCostFactor', 12);
    const passwordHash = await bcrypt.hash(dto.password, bcryptCost);

    let user: { id: string; role: UserRole; museumId: string | null };
    try {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          displayName: dto.displayName,
          dateOfBirth: new Date(dto.dateOfBirth),
          role: UserRole.user,
          preferences: {
            language: 'tr',
            preferredDifficulty: 'medium',
            accessibility: { reducedMotion: false, highContrast: false },
          },
        },
      });
    } catch (err) {
      // Concurrent registration with the same email won the race — surface as 409
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ApiException(
          'An account with this email already exists.',
          ErrorCode.AUTH_EMAIL_EXISTS,
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }

    return this.buildTokens(user.id, user.role, user.museumId, deviceHint);
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  async login(dto: LoginDto, deviceHint?: string): Promise<AuthTokens & { deletedAt: Date | null }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new ApiException(
        'Invalid email or password.',
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Account lockout check (before password verification)
    await this.checkAndEnforceAccountLockout(user.id, user.email);

    if (!user.passwordHash) {
      throw new ApiException(
        'This account uses social login. Please sign in with Google.',
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        HttpStatus.UNAUTHORIZED,
      );
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatch) {
      await this.incrementLoginAttempts(user.id);
      throw new ApiException(
        'Invalid email or password.',
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.isBanned) {
      throw new ApiException(
        'Your account has been suspended.',
        ErrorCode.AUTH_ACCOUNT_BANNED,
        HttpStatus.FORBIDDEN,
      );
    }

    // Successful login — clear attempt counter
    await this.clearLoginAttempts(user.id);

    const tokens = await this.buildTokens(user.id, user.role, user.museumId, deviceHint);
    return { ...tokens, deletedAt: user.deletedAt };
  }

  // ── Refresh Token ─────────────────────────────────────────────────────────

  async refreshTokens(rawRefreshToken: string, deviceHint?: string): Promise<AuthTokens> {
    const result = await this.tokenService.validateRefreshToken(rawRefreshToken);

    if (!result) {
      throw new ApiException(
        'Invalid or expired refresh token.',
        ErrorCode.AUTH_TOKEN_INVALID,
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: result.userId },
    });

    if (!user || user.isBanned) {
      throw new ApiException(
        'Auth token is no longer valid.',
        ErrorCode.AUTH_TOKEN_INVALID,
        HttpStatus.UNAUTHORIZED,
      );
    }

    const newRefreshToken = await this.tokenService.rotateRefreshToken(
      result.jti,
      user.id,
      deviceHint,
    );

    const accessToken = this.tokenService.issueAccessToken({
      sub: user.id,
      role: user.role,
      museumId: user.museumId,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken.rawToken,
      expiresAt: newRefreshToken.expiresAt,
    };
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  async logout(rawRefreshToken: string): Promise<void> {
    const result = await this.tokenService.validateRefreshToken(rawRefreshToken);
    if (result) {
      await this.tokenService.revokeRefreshToken(result.jti);
    }
  }

  // ── Forgot Password ───────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Always return 200 — prevents email enumeration
    if (!user) return;

    const rawToken = randomBytes(32).toString('hex');
    const tokenKey = `password_reset:${createHash('sha256').update(rawToken).digest('hex')}`;
    const ttlSec = Math.ceil(this.config.get<number>('auth.passwordResetTtlMs', 900_000) / 1000);

    await this.redis.set(
      tokenKey,
      JSON.stringify({ userId: user.id, email: user.email, createdAt: Date.now() }),
      'EX',
      ttlSec,
    );

    const frontendUrl = this.config.get<string>('auth.frontendUrl', 'http://localhost:5173');
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    await this.sendPasswordResetEmail(user.email, resetLink).catch((err: unknown) => {
      this.logger.error('Failed to send password reset email', err);
    });
  }

  // ── Reset Password ────────────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenKey = `password_reset:${createHash('sha256').update(dto.token).digest('hex')}`;
    const stored = await this.redis.get(tokenKey);

    if (!stored) {
      throw new ApiException(
        'Password reset token is invalid or has expired.',
        ErrorCode.AUTH_RESET_TOKEN_INVALID,
        HttpStatus.BAD_REQUEST,
      );
    }

    let parsed: { userId?: unknown };
    try {
      parsed = JSON.parse(stored) as { userId?: unknown };
    } catch {
      throw new ApiException(
        'Password reset token is invalid or has expired.',
        ErrorCode.AUTH_RESET_TOKEN_INVALID,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!parsed.userId || typeof parsed.userId !== 'string') {
      throw new ApiException(
        'Password reset token is invalid or has expired.',
        ErrorCode.AUTH_RESET_TOKEN_INVALID,
        HttpStatus.BAD_REQUEST,
      );
    }

    const { userId } = parsed as { userId: string };
    const bcryptCost = this.config.get<number>('auth.bcryptCostFactor', 12);
    const passwordHash = await bcrypt.hash(dto.newPassword, bcryptCost);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Single-use: delete the Redis key
    await this.redis.del(tokenKey);

    // Revoke all refresh tokens (force re-login on all devices)
    await this.tokenService.revokeAllUserRefreshTokens(userId);
  }

  // ── Google OAuth2 ─────────────────────────────────────────────────────────

  async handleGoogleCallback(
    googleProfile: {
      email: string;
      displayName: string;
      googleId: string;
    },
    deviceHint?: string,
  ): Promise<AuthTokens> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: googleProfile.email },
    });

    if (existingUser) {
      if (existingUser.passwordHash !== null) {
        // Account exists with a password — do NOT auto-merge
        throw new ApiException(
          'An account with this email already exists. Please sign in with your email and password.',
          ErrorCode.AUTH_EMAIL_EXISTS_DIFFERENT_PROVIDER,
          HttpStatus.CONFLICT,
        );
      }

      // Existing social-only account — sign in
      return this.buildTokens(existingUser.id, existingUser.role, existingUser.museumId, deviceHint);
    }

    // Create new social account (passwordHash = null)
    const user = await this.prisma.user.create({
      data: {
        email: googleProfile.email,
        passwordHash: null,
        displayName: googleProfile.displayName,
        dateOfBirth: new Date('1900-01-01'), // Placeholder — age gate MVP-STUB
        role: UserRole.user,
        preferences: {
          language: 'tr',
          preferredDifficulty: 'medium',
          accessibility: { reducedMotion: false, highContrast: false },
        },
      },
    });

    return this.buildTokens(user.id, user.role, user.museumId, deviceHint);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async buildTokens(
    userId: string,
    role: string,
    museumId: string | null,
    deviceHint?: string,
  ): Promise<AuthTokens> {
    const accessToken = this.tokenService.issueAccessToken({
      sub: userId,
      role,
      museumId,
    });

    const refreshResult = await this.tokenService.issueRefreshToken(userId, deviceHint);

    return {
      accessToken,
      refreshToken: refreshResult.rawToken,
      expiresAt: refreshResult.expiresAt,
    };
  }

  private async checkAndEnforceAccountLockout(userId: string, _email: string): Promise<void> {
    const maxAttempts = this.config.get<number>('auth.maxLoginAttempts', 5);
    const key = `login_attempts:${userId}`;
    const attempts = await this.redis.get(key);

    if (attempts && parseInt(attempts, 10) >= maxAttempts) {
      throw new ApiException(
        'Account is temporarily locked due to too many failed login attempts. Try again in 15 minutes.',
        ErrorCode.AUTH_ACCOUNT_LOCKED,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async incrementLoginAttempts(userId: string): Promise<void> {
    const lockoutTtlSec = Math.ceil(
      this.config.get<number>('auth.lockoutDurationMs', 900_000) / 1000,
    );
    const key = `login_attempts:${userId}`;
    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.expire(key, lockoutTtlSec);
    }
  }

  private async clearLoginAttempts(userId: string): Promise<void> {
    await this.redis.del(`login_attempts:${userId}`);
  }

  private async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    const sendgridKey = this.config.get<string>('auth.sendgridApiKey', '');
    const fromEmail = this.config.get<string>('auth.fromEmail', 'noreply@museumquest.app');

    const transporter = createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: sendgridKey,
      },
    });

    await transporter.sendMail({
      from: fromEmail,
      to,
      subject: 'MuseumQuest — Reset your password',
      html: `
        <p>You requested a password reset for your MuseumQuest account.</p>
        <p><a href="${resetLink}">Click here to reset your password</a></p>
        <p>This link expires in 15 minutes.</p>
        <p>If you did not request this, you can safely ignore this email.</p>
      `,
    });
  }
}
