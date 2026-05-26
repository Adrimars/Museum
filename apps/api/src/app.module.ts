import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { RedisThrottlerGuard } from './common/guards/redis-throttler.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { LoggerModule } from './common/logger/logger.module';
import analyticsConfig from './config/analytics.config';
import anthropicConfig from './config/anthropic.config';
import appConfig from './config/app.config';
import authConfig from './config/auth.config';
import awsConfig from './config/aws.config';
import databaseConfig from './config/database.config';
import openaiConfig from './config/openai.config';
import qrConfig from './config/qr.config';
import redisConfig from './config/redis.config';
import { AiModule } from './modules/ai/ai.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ArtifactsModule } from './modules/artifacts/artifacts.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { GameModule } from './modules/game/game.module';
import { QuizModule } from './modules/quiz/quiz.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { HealthModule } from './modules/health/health.module';
import { MediaModule } from './modules/media/media.module';
import { MuseumsModule } from './modules/museums/museums.module';
import { QrModule } from './modules/qr/qr.module';
import { StorageModule } from './modules/storage/storage.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [analyticsConfig, anthropicConfig, appConfig, authConfig, awsConfig, databaseConfig, openaiConfig, qrConfig, redisConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('redis.host', 'localhost'),
          port: config.get('redis.port', 6379),
          password: config.get<string | undefined>('redis.password'),
        },
      }),
    }),
    ScheduleModule.forRoot(),
    LoggerModule,
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    MuseumsModule,
    UsersModule,
    ArtifactsModule,
    GameModule,
    QuizModule,
    RewardsModule,
    QrModule,
    StorageModule,
    MediaModule,
    AiModule,
    AnalyticsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RedisThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
