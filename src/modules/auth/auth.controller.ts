import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Profile } from 'passport';

import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { SetPasswordDto } from './dto/set-password.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { RequestWithUser } from '../../common/types/request.types.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.loginWithEmail(dto);
  }

  // ─── Google OAuth ──────────────────────────────────────

  @Get('google')
  @UseGuards(PassportAuthGuard('google'))
  async googleLogin() {}

  @Get('google/callback')
  @UseGuards(PassportAuthGuard('google'))
  async googleCallback(@Res() res: any, @Body() _body: any) {
    // req.user is populated by Passport strategy
    const req = res.req;
    const data = req.user as Profile;
    const tokens = await this.authService.registerOrLoginWithGoogle(data);
    const frontendUrl = this.configService.get<string>('app.frontendUrl', 'http://localhost:3001');
    return res.redirect(
      `${frontendUrl}/auth-callback?token=${tokens.access_token}&refresh_token=${tokens.refresh_token}`,
    );
  }

  // ─── Email Verification ────────────────────────────────

  @Get('verify/:id')
  async verifyEmail(@Param('id') id: string) {
    return this.authService.verifyEmail(id);
  }

  // ─── Password Management ──────────────────────────────

  @UseGuards(AuthGuard)
  @Post('set-password')
  async setPassword(@CurrentUser() userId: string, @Body() dto: SetPasswordDto) {
    return this.authService.setPassword(userId, dto);
  }

  @UseGuards(AuthGuard)
  @Post('change-password')
  async changePassword(@CurrentUser() userId: string, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(userId, dto);
  }

  @Post('password-reset-request')
  async requestPasswordReset(@Body() data: { email: string }) {
    return this.authService.sendResetPasswordLink(data.email);
  }

  @Post('reset-password/:id')
  async resetPassword(@Param('id') id: string, @Body() dto: SetPasswordDto) {
    return this.authService.resetPassword(id, dto);
  }

  // ─── Token Refresh ─────────────────────────────────────

  @Post('refresh')
  async refreshTokens(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refresh_token);
  }
}
