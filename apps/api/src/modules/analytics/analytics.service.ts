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

  // ── S7-14: Funnel analysis — 5 standard visitor journey funnels ───────────

  async getFunnels(museumId: string, from: Date, to: Date): Promise<FunnelResult[]> {
    const funnels: Array<{ name: string; steps: string[] }> = [
      { name: 'discovery_to_reward',   steps: ['artifact_scan', 'game_start', 'game_complete', 'reward_issued'] },
      { name: 'scan_to_ai',            steps: ['artifact_scan', 'ai_session_started', 'ai_message_sent'] },
      { name: 'game_to_completion',    steps: ['game_start', 'quiz_answer', 'game_complete'] },
      { name: 'register_to_first_game', steps: ['user_register', 'artifact_scan', 'game_start'] },
      { name: 'ai_engagement',         steps: ['ai_session_started', 'ai_message_sent'] },
    ];

    const results: FunnelResult[] = [];

    for (const funnel of funnels) {
      const stepRows = await this.prisma.$queryRaw<Array<{ event_type: string; unique_users: bigint }>>`
        SELECT event_type, COUNT(DISTINCT user_id_hash) AS unique_users
        FROM analytics_events
        WHERE museum_id   = ${museumId}::uuid
          AND occurred_at >= ${from}
          AND occurred_at <  ${to}
          AND event_type  = ANY(${funnel.steps}::text[])
        GROUP BY event_type
      `;

      const countByEvent = new Map(stepRows.map((r) => [r.event_type, Number(r.unique_users)]));

      const steps: FunnelStep[] = funnel.steps.map((step, idx) => {
        const count = countByEvent.get(step) ?? 0;
        const prevCount = idx === 0 ? count : (countByEvent.get(funnel.steps[idx - 1]!) ?? 0);
        return {
          eventType:      step,
          uniqueUsers:    count,
          conversionRate: prevCount > 0 ? Math.round((count / prevCount) * 10000) / 100 : 0,
        };
      });

      results.push({ funnel: funnel.name, steps });
    }

    return results;
  }

  // ── S7-15: Nightly user segmentation across all museums ───────────────────
  // Tiers (30-day event count): highly_engaged ≥10, engaged 5-9, passive 1-4, churned 0

  async runUserSegmentation(): Promise<SegmentSummary[]> {
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.$queryRaw<
      Array<{ museum_id: string; user_id_hash: string; event_count: bigint }>
    >`
      SELECT museum_id::text, user_id_hash, COUNT(*) AS event_count
      FROM analytics_events
      WHERE occurred_at >= ${from}
        AND user_id_hash IS NOT NULL
      GROUP BY museum_id, user_id_hash
    `;

    const byMuseum = new Map<string, SegmentSummary>();
    for (const row of rows) {
      if (!byMuseum.has(row.museum_id)) {
        byMuseum.set(row.museum_id, {
          museum_id: row.museum_id, highly_engaged: 0, engaged: 0, passive: 0, churned: 0, total_users: 0,
        });
      }
      const s = byMuseum.get(row.museum_id)!;
      const n = Number(row.event_count);
      s.total_users++;
      if (n >= 10)     s.highly_engaged++;
      else if (n >= 5) s.engaged++;
      else if (n >= 1) s.passive++;
      else             s.churned++;
    }

    return [...byMuseum.values()];
  }
}

export interface SegmentSummary {
  museum_id:      string;
  highly_engaged: number;
  engaged:        number;
  passive:        number;
  churned:        number;
  total_users:    number;
}

export interface FunnelStep {
  eventType:      string;
  uniqueUsers:    number;
  conversionRate: number;
}

export interface FunnelResult {
  funnel: string;
  steps:  FunnelStep[];
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
