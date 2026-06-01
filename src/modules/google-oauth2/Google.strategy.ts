import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile } from 'passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private env : ConfigService) {
    super({
      clientID : env.get('GOOGLE_CLIENT_ID')!,
      clientSecret: env.get('GOOGLE_CLIENT_SECRET')!,
      callbackURL: env.get('GOOGLE_CALLBACK_URL')!,
      scope: ['email', 'profile'],
    });
  }

    async validate(accessToken: string, refreshToken: string, profile: Profile) {
      console.log('Google Strategy validate called with profile:', profile);
      return {
        id: profile.id,
        emails: profile.emails,
        name: profile.name,
        photos: profile.photos,
      } as any;
    }
}