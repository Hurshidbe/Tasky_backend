import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DatabaseModule } from './modules/database/database.module.js';
import { CacheConfigModule } from './modules/cache/cache.module.js';
import { GoogleOauth2Module } from './modules/google-oauth2/google-oauth2.module.js';
import { MailModule } from './modules/mail/mail.module.js';
import { ProjectModule } from './modules/project/project.module.js';
import { ProfileModule } from './modules/profile/profile.module.js';
import { BoardModule } from './modules/board/board.module.js';
import { CloudinaryModule } from './modules/cloudinary/cloudinary.module.js';

import {
  appConfig,
  databaseConfig,
  jwtConfig,
  mailConfig,
  cloudinaryConfig,
  googleOAuthConfig,
  corsConfig,
} from './config/index.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        jwtConfig,
        mailConfig,
        cloudinaryConfig,
        googleOAuthConfig,
        corsConfig,
      ],
      envFilePath: '.env',
    }),
    AuthModule,
    DatabaseModule,
    CacheConfigModule,
    GoogleOauth2Module,
    MailModule,
    ProjectModule,
    ProfileModule,
    BoardModule,
    CloudinaryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
