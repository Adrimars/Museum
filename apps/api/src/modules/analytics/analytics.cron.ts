import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { AnalyticsService } from './analytics.service';

@Injectable()
export class AnalyticsCron {
  private readonly logger = new Logger(AnalyticsCron.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  // S7-15: Nightly user segmentation — runs at 03:00 every day
  @Cron('0 3 * * *')
  async runUserSegmentation(): Promise<void> {
    this.logger.log('Starting nightly user segmentation');
    try {
      const summary = await this.analyticsService.runUserSegmentation();
      this.logger.log('User segmentation complete', summary);
    } catch (err) {
      this.logger.error('User segmentation failed', err);
    }
  }
}
