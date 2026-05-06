import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        privateKey: config.getOrThrow<string>('auth.jwtPrivateKey'),
        publicKey: config.getOrThrow<string>('auth.jwtPublicKey'),
        signOptions: {
          algorithm: 'RS256',
          expiresIn: config.get<string>('auth.jwtAccessExpiry', '15m'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtStrategy, GoogleStrategy],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
