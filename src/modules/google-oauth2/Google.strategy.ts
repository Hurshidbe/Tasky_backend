import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile } from 'passport';
import { Strategy } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('googleOAuth.clientId')!,
      clientSecret: configService.get<string>('googleOAuth.clientSecret')!,
      callbackURL: configService.get<string>('googleOAuth.callbackUrl')!,
      scope: ['email', 'profile'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: Profile) {
    return {
      id: profile.id,
      emails: profile.emails,
      name: profile.name,
      photos: profile.photos,
    } as any;
  }
}
