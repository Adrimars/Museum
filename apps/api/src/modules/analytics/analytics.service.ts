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

  // ── S7-13: Artifact heatmap — weighted composite score per artifact ────────
  // Weights: 40% scans, 30% AI interactions, 20% views, 10% dwell events

  async getHeatmap(museumId: string, from: Date, to: Date): Promise<HeatmapRow[]> {
    const rows = await this.prisma.$queryRaw<RawHeatmapRow[]>`
      SELECT
        payload->>'artifactId'           AS "artifactId",
        SUM(CASE WHEN event_type = 'artifact_scan'     THEN 1 ELSE 0 END) AS scans,
        SUM(CASE WHEN event_type = 'ai_message_sent'   THEN 1 ELSE 0 END) AS ai_interactions,
        SUM(CASE WHEN event_type = 'artifact_view'     THEN 1 ELSE 0 END) AS views,
        SUM(CASE WHEN event_type = 'artifact_dwell'    THEN 1 ELSE 0 END) AS dwell_events,
        COUNT(*)                                                            AS total_events
      FROM analytics_events
      WHERE museum_id   = ${museumId}::uuid
        AND occurred_at >= ${from}
        AND occurred_at <  ${to}
        AND payload->>'artifactId' IS NOT NULL
        AND event_type IN ('artifact_scan', 'ai_message_sent', 'artifact_view', 'artifact_dwell')
      GROUP BY payload->>'artifactId'
      ORDER BY total_events DESC
    `;

    return rows.map((r) => ({
      artifactId:     r.artifactId,
      scans:          Number(r.scans),
      aiInteractions: Number(r.ai_interactions),
      views:          Number(r.views),
      dwellEvents:    Number(r.dwell_events),
      score:
        Number(r.scans)          * 0.4 +
        Number(r.ai_interactions) * 0.3 +
        Number(r.views)           * 0.2 +
        Number(r.dwell_events)    * 0.1,
    }));
  }
}

interface RawHeatmapRow {
  artifactId:      string;
  scans:           bigint;
  ai_interactions: bigint;
  views:           bigint;
  dwell_events:    bigint;
  total_events:    bigint;
}

export interface HeatmapRow {
  artifactId:     string;
  scans:          number;
  aiInteractions: number;
  views:          number;
  dwellEvents:    number;
  score:          number;
}
