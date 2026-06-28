import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { Auth, AuthSchema } from './schema/auth.schema.js';
import { RefreshToken, RefreshTokenSchema } from './schema/refreshToken.schema.js';
import { ResetPass, ResetPassSchema } from './schema/resetPass.schema.js';
import { DatabaseModule } from '../database/database.module.js';
import { CacheConfigModule } from '../cache/cache.module.js';
import { GoogleOauth2Module } from '../google-oauth2/google-oauth2.module.js';
import { MailModule } from '../mail/mail.module.js';

@Module({
  imports: [
    DatabaseModule,
    GoogleOauth2Module,
    MongooseModule.forFeature([
      { name: Auth.name, schema: AuthSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: ResetPass.name, schema: ResetPassSchema },
    ]),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', ''),
        signOptions: {
          expiresIn: configService.get<any>('JWT_EXPIRES_IN', '5h'),
        },
      }),
    }),
    CacheConfigModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
