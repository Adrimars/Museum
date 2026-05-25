import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Job } from 'bull';

import { PrismaService } from '../../prisma/prisma.service';

import { ANALYTICS_QUEUE, AnalyticsService, type AnalyticsEventJob } from './analytics.service';

@Processor(ANALYTICS_QUEUE)
export class AnalyticsProcessor {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  // S7-10 / S7-11: Pseudonymize userId then insert into TimescaleDB hypertable
  @Process()
  async handle(job: Job<AnalyticsEventJob>): Promise<void> {
    const { eventType, museumId, userId, payload, occurredAt } = job.data;

    try {
      const userIdHash = userId ? this.analyticsService.pseudonymize(userId) : null;

      await this.prisma.analyticsEvent.create({
        data: {
          museumId: museumId ?? null,
          userIdHash,
          eventType,
          payload: (payload ?? {}) as Prisma.InputJsonValue,
          occurredAt: new Date(occurredAt),
        },
      });
    } catch (err) {
      // Fire-and-forget: log but never surface failures to callers
      this.logger.error('Analytics event processing failed', { eventType, err });
    }
  }
}
