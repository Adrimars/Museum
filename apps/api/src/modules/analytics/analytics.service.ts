import { createHmac } from 'crypto';

import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { Queue } from 'bull';

import { PrismaService } from '../../prisma/prisma.service';

export const ANALYTICS_QUEUE = 'analytics';

export interface AnalyticsEventJob {
  eventType: string;
  occurredAt: string;
  museumId?: string;
  userId?: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly hmacSalt: string;

  constructor(
    readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(ANALYTICS_QUEUE) private readonly analyticsQueue: Queue<AnalyticsEventJob>,
  ) {
    this.hmacSalt = config.get<string>('analytics.hmacSalt', 'museumquest-analytics-salt');
  }

  // ── S7-10: Fire-and-forget event emission via Bull queue ──────────────────

  emit(
    eventType: string,
    museumId?: string,
    userId?: string,
    payload?: Record<string, unknown>,
  ): void {
    const job: AnalyticsEventJob = {
      eventType,
      occurredAt: new Date().toISOString(),
      ...(museumId !== undefined && { museumId }),
      ...(userId !== undefined && { userId }),
      payload: payload ?? {},
    };

    this.analyticsQueue
      .add(job, { attempts: 1, removeOnComplete: true, removeOnFail: true })
      .catch((err: unknown) => {
        this.logger.error('Failed to enqueue analytics event', { eventType, err });
      });
  }

  // ── S7-11: Salted HMAC-SHA256 pseudonymization (KVKK/GDPR compliant) ─────

  pseudonymize(userId: string): string {
    return createHmac('sha256', this.hmacSalt).update(userId).digest('hex');
  }
}
