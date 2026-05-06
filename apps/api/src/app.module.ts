import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { RedisThrottlerGuard } from './common/guards/redis-throttler.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { LoggerModule } from './common/logger/logger.module';
import appConfig from './config/app.config';
import authConfig from './config/auth.config';
import awsConfig from './config/aws.config';
import databaseConfig from './config/database.config';
import qrConfig from './config/qr.config';
import redisConfig from './config/redis.config';
import { ArtifactsModule } from './modules/artifacts/artifacts.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { MuseumsModule } from './modules/museums/museums.module';
import { MediaModule } from './modules/media/media.module';
import { QrModule } from './modules/qr/qr.module';
import { StorageModule } from './modules/storage/storage.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, awsConfig, databaseConfig, qrConfig, redisConfig],
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
    LoggerModule,
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    MuseumsModule,
    UsersModule,
    ArtifactsModule,
    QrModule,
    StorageModule,
    MediaModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RedisThrottlerGuard,
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
