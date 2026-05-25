import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsCron } from './analytics.cron';
import { AnalyticsProcessor } from './analytics.processor';
import { AnalyticsService, ANALYTICS_QUEUE } from './analytics.service';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({ name: ANALYTICS_QUEUE }),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsProcessor, AnalyticsCron],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
