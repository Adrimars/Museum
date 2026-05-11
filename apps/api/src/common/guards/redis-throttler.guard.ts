import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import Redis from 'ioredis';

import { REDIS_CLIENT } from '../../redis/redis.module';
import { THROTTLE_GROUP_KEY, type ThrottleGroupName } from '../decorators/throttle-group.decorator';

interface GroupLimits {
  limit: number;
  windowMs: number;
}

@Injectable()
export class RedisThrottlerGuard implements CanActivate {
  private readonly logger = new Logger(RedisThrottlerGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    const group = this.reflector.getAllAndOverride<ThrottleGroupName | undefined>(
      THROTTLE_GROUP_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Fingerprint by IP only — never decode an unverified JWT here.
    // The JwtAuthGuard runs after global APP_GUARDs so req.user is not yet
    // populated; trusting raw Authorization header bytes allows sub-forgery.
    const fingerprint = req.ip ?? 'unknown';
    const effectiveGroup: ThrottleGroupName = group ?? 'public';

    const { limit, windowMs } = this.getLimits(effectiveGroup);
    const key = `rl:${fingerprint}:${effectiveGroup}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      const pipeline = this.redis.pipeline();
      pipeline.zremrangebyscore(key, '-inf', windowStart);
      pipeline.zadd(key, now, `${now}-${Math.random().toString(36).slice(2)}`);
      pipeline.zcard(key);
      pipeline.expire(key, Math.ceil(windowMs / 1000));

      const results = await pipeline.exec();
      const count = (results?.[2]?.[1] as number) ?? 0;

      if (count > limit) {
        throw new HttpException(
          { message: 'Too many requests. Please slow down.', errorCode: 'RATE_LIMIT_EXCEEDED' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
      // Redis unavailable — fail open so the app stays functional
      this.logger.warn('Redis throttler unavailable, skipping rate limit check');
    }

    return true;
  }

  private getLimits(group: ThrottleGroupName): GroupLimits {
    switch (group) {
      case 'auth':
        return {
          limit: this.config.get<number>('app.rateLimitAuth', 10),
          windowMs: this.config.get<number>('app.rateLimitAuthWindowMs', 900_000),
        };
      case 'public':
        return {
          limit: this.config.get<number>('app.rateLimitPublic', 100),
          windowMs: this.config.get<number>('app.rateLimitPublicWindowMs', 60_000),
        };
      case 'authenticated':
        return {
          limit: this.config.get<number>('app.rateLimitAuthenticated', 300),
          windowMs: this.config.get<number>('app.rateLimitAuthenticatedWindowMs', 60_000),
        };
    }
  }
}
