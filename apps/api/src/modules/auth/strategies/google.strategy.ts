import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile, type VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('auth.googleClientId', ''),
      clientSecret: config.get<string>('auth.googleClientSecret', ''),
      callbackURL: config.get<string>('auth.googleCallbackUrl', ''),
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value ?? '';
    const displayName = profile.displayName ?? email.split('@')[0] ?? 'User';

    done(null, {
      googleId: profile.id,
      email,
      displayName,
    });
  }
}
