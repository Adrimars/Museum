import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import Redis from 'ioredis';

import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';

@ApiTags('Health')
@Controller({ path: 'health', version: [] })
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe — returns 200 if the process is running' })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — checks PostgreSQL and Redis connectivity' })
  async ready(): Promise<{ status: 'ok'; checks: Record<string, string> }> {
    const checks: Record<string, string> = {};

    await this.prisma.$queryRaw`SELECT 1`;
    checks['postgres'] = 'ok';

    await this.redis.ping();
    checks['redis'] = 'ok';

    return { status: 'ok', checks };
  }
}
