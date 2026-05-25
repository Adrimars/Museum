import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

import { AiController } from './ai.controller';
import { AiGateway } from './ai.gateway';
import { AiService } from './ai.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    // JwtModule needed for manual WebSocket JWT validation in the gateway
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        publicKey: config.getOrThrow<string>('auth.jwtPublicKey'),
        verifyOptions: { algorithms: ['RS256'] },
      }),
    }),
  ],
  controllers: [AiController],
  providers: [AiService, AiGateway],
  exports: [AiService],
})
export class AiModule {}
