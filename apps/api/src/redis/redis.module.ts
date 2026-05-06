import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const redisUrl = config.get<string>('redis.url');
        if (redisUrl) {
          return new Redis(redisUrl);
        }
        return new Redis({
          host: config.get('redis.host', 'localhost'),
          port: config.get('redis.port', 6379),
          password: config.get<string | undefined>('redis.password'),
          enableReadyCheck: true,
          maxRetriesPerRequest: 3,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
