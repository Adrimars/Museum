import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { ApiException } from '../../common/exceptions/api.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
};

const mockTokenService = {
  issueAccessToken: jest.fn().mockReturnValue('mock.access.token'),
  issueRefreshToken: jest.fn().mockResolvedValue({
    rawToken: 'mock-raw-refresh',
    jti: 'mock-jti',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    tokenHash: 'hash',
  }),
  validateRefreshToken: jest.fn(),
  revokeRefreshToken: jest.fn(),
  revokeAllUserRefreshTokens: jest.fn(),
  rotateRefreshToken: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string, defaultVal?: unknown) => {
    const map: Record<string, unknown> = {
      'auth.bcryptCostFactor': 4, // low cost for tests
      'auth.maxLoginAttempts': 5,
      'auth.lockoutDurationMs': 900_000,
      'auth.passwordResetTtlMs': 900_000,
      'auth.frontendUrl': 'http://localhost:5173',
      'auth.sendgridApiKey': '',
      'auth.fromEmail': 'noreply@test.com',
    };
    return map[key] ?? defaultVal;
  }),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TokenService, useValue: mockTokenService },
        { provide: REDIS_CLIENT, useValue: mockRedis },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('throws CONFLICT if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-id' });

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'Test@1234',
          displayName: 'Test User',
          dateOfBirth: '1995-01-01',
        }),
      ).rejects.toMatchObject({
        response: { errorCode: 'AUTH_EMAIL_EXISTS' },
        status: HttpStatus.CONFLICT,
      });
    });

    it('returns 409 when a concurrent registration wins the unique-constraint race', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null); // check passes
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      mockPrisma.user.create.mockRejectedValue(p2002);

      await expect(
        service.register({
          email: 'race@example.com',
          password: 'Test@1234',
          displayName: 'Race User',
          dateOfBirth: '1995-01-01',
        }),
      ).rejects.toMatchObject({
        response: { errorCode: 'AUTH_EMAIL_EXISTS' },
        status: HttpStatus.CONFLICT,
      });
    });

    it('creates user and returns tokens on success', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user-id',
        role: UserRole.user,
        museumId: null,
      });

      const result = await service.register({
        email: 'new@example.com',
        password: 'Test@1234!',
        displayName: 'New User',
        dateOfBirth: '1995-01-01',
      });

      expect(result.accessToken).toBe('mock.access.token');
      expect(result.refreshToken).toBe('mock-raw-refresh');
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('login', () => {
    it('throws UNAUTHORIZED for non-existent email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockRedis.get.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@example.com', password: 'pw' }),
      ).rejects.toMatchObject({
        response: { errorCode: 'AUTH_INVALID_CREDENTIALS' },
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('throws TOO_MANY_REQUESTS when account is locked', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        passwordHash: 'hash',
        isBanned: false,
      });
      mockRedis.get.mockResolvedValue('5'); // 5 failed attempts

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toMatchObject({
        response: { errorCode: 'AUTH_ACCOUNT_LOCKED' },
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });

    it('issues tokens on valid credentials', async () => {
      const hash = await bcrypt.hash('Correct@1234', 4);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        passwordHash: hash,
        isBanned: false,
        role: UserRole.user,
        museumId: null,
        deletedAt: null,
      });
      mockRedis.get.mockResolvedValue(null);
      mockRedis.del.mockResolvedValue(1);

      const result = await service.login({
        email: 'test@example.com',
        password: 'Correct@1234',
      });

      expect(result.accessToken).toBe('mock.access.token');
    });
  });

  describe('logout', () => {
    it('revokes the refresh token if valid', async () => {
      mockTokenService.validateRefreshToken.mockResolvedValue({
        userId: 'uid',
        jti: 'some-jti',
      });

      await service.logout('raw-token');

      expect(mockTokenService.revokeRefreshToken).toHaveBeenCalledWith('some-jti');
    });

    it('does nothing if refresh token is already invalid', async () => {
      mockTokenService.validateRefreshToken.mockResolvedValue(null);

      await expect(service.logout('bad-token')).resolves.toBeUndefined();
      expect(mockTokenService.revokeRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('throws BAD_REQUEST for invalid token', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(
        service.resetPassword({ token: 'invalid', newPassword: 'New@Pass1234' }),
      ).rejects.toMatchObject({
        response: { errorCode: 'AUTH_RESET_TOKEN_INVALID' },
        status: HttpStatus.BAD_REQUEST,
      });
    });
  });

  describe('handleGoogleCallback', () => {
    it('throws CONFLICT if email exists with password (different provider)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uid',
        passwordHash: 'some-hash',
      });

      await expect(
        service.handleGoogleCallback({
          email: 'existing@example.com',
          displayName: 'Existing',
          googleId: 'g123',
        }),
      ).rejects.toMatchObject({
        response: { errorCode: 'AUTH_EMAIL_EXISTS_DIFFERENT_PROVIDER' },
        status: HttpStatus.CONFLICT,
      });
    });
  });
});
