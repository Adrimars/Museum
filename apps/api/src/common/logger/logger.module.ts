import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transports: [
          new winston.transports.Console({
            format:
              config.get<string>('app.nodeEnv') === 'production'
                ? winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.json(),
                  )
                : winston.format.combine(
                    winston.format.colorize(),
                    winston.format.timestamp({ format: 'HH:mm:ss' }),
                    winston.format.printf(({ level, message, timestamp, ...meta }) => {
                      const extras = Object.keys(meta).length
                        ? ` ${JSON.stringify(meta)}`
                        : '';
                      return `${String(timestamp)} [${level}] ${String(message)}${extras}`;
                    }),
                  ),
          }),
        ],
      }),
    }),
  ],
  exports: [WinstonModule],
})
export class LoggerModule {}
