import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { Profile } from 'passport';

import { Auth } from './schema/auth.schema.js';
import { RefreshToken } from './schema/refreshToken.schema.js';
import { ResetPass } from './schema/resetPass.schema.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { SetPasswordDto } from './dto/set-password.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { MailService } from '../mail/mail.service.js';
import { BCRYPT_SALT_ROUNDS } from '../../common/constants/app.constants.js';

/** Maximum login attempts before temporary lockout */
const MAX_LOGIN_ATTEMPTS = 5;
/** Lockout duration in milliseconds (2 minutes) */
const LOGIN_LOCKOUT_MS = 120_000;

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Auth.name) private readonly userRepo: Model<Auth>,
    @InjectModel(RefreshToken.name) private readonly refreshTokenRepo: Model<RefreshToken>,
    @InjectModel(ResetPass.name) private readonly resetPassRepo: Model<ResetPass>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Registration ──────────────────────────────────────

  async register(dto: RegisterDto) {
    if (dto.password !== dto.return_password) {
      throw new BadRequestException('Passwords do not match');
    }

    const email = dto.email.toLowerCase().trim();
    const existingUser = await this.userRepo.findOne({ email });
    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const user = await this.userRepo.create({
      email,
      password: hashedPassword,
      firstname: email.split('@')[0],
    });

    return { status: 'success', created: user };
  }

  async registerOrLoginWithGoogle(data: Profile) {
    const googleUser = {
      google_id: data.id,
      email: data.emails?.[0]?.value.toLowerCase().trim(),
      name: data.name?.givenName,
      avatar: data.photos?.[0]?.value,
    };

    let user = await this.userRepo.findOne({ email: googleUser.email });

    if (!user) {
      const newUser = await this.userRepo.create({
        google_id: googleUser.google_id,
        email: googleUser.email,
        firstname: googleUser.name,
        avatar: googleUser.avatar,
        is_email_verified: true,
      });
      return this.generateTokens(newUser._id);
    }

    if (!user.google_id || !user.is_email_verified) {
      user = await this.userRepo.findByIdAndUpdate(
        user._id,
        { $set: { google_id: googleUser.google_id, is_email_verified: true } },
        { returnDocument: 'after' },
      );
    }

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.generateTokens(user._id);
  }

  // ─── Login ─────────────────────────────────────────────

  async loginWithEmail(dto: LoginDto) {
    const cacheKey = `login_attempts:${dto.email}`;
    const attempts = (await this.cacheManager.get<number>(cacheKey)) ?? 0;

    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      throw new UnauthorizedException('Too many attempts, try again after 2 minutes');
    }

    const email = dto.email.toLowerCase().trim();
    const user = await this.userRepo.findOne({ email });
    const passwordMatch = user?.password
      ? await bcrypt.compare(dto.password, user.password)
      : false;

    if (!user || !passwordMatch) {
      await this.cacheManager.set(cacheKey, attempts + 1, LOGIN_LOCKOUT_MS);
      throw new UnauthorizedException('Incorrect email or password');
    }

    if (!user.is_email_verified) {
      await this.mailService.sendActivateEmail(user._id, user.email);
      throw new UnauthorizedException(
        "Please verify your email before logging in. We've sent a verification link to your email address. Check your spam or junk folder if you can't find it.",
      );
    }

    await this.cacheManager.del(cacheKey);
    return this.generateTokens(user._id);
  }

  // ─── Password Management ──────────────────────────────

  async setPassword(userId: string, dto: SetPasswordDto) {
    if (dto.password !== dto.return_password) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.google_id) {
      throw new UnauthorizedException(
        'This operation is only for Google-logged users who have not set a password',
      );
    }

    await this.userRepo.findByIdAndUpdate(userId, {
      password: await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS),
    });

    return 'Password successfully created';
  }

  async sendResetPasswordLink(email: string) {
    const user = await this.userRepo.findOne({ email });
    if (!user) {
      throw new BadRequestException('No account found with this email');
    }

    await this.resetPassRepo.findByIdAndDelete(user._id);
    await this.resetPassRepo.create({ user: user._id, used: false });
    return this.mailService.sendResetPasswordLink(user._id, user.email);
  }

  async resetPassword(userId: string, dto: SetPasswordDto) {
    if (dto.password !== dto.return_password) {
      throw new UnauthorizedException('Passwords do not match');
    }

    const resetRequest = await this.resetPassRepo.findOne({
      user: new Types.ObjectId(userId),
      used: false,
      expire: { $gte: new Date() },
    });

    if (!resetRequest) {
      throw new BadRequestException('Reset link is invalid or expired');
    }

    await this.userRepo.findByIdAndUpdate(userId, {
      password: await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS),
    });

    resetRequest.used = true;
    await resetRequest.save();

    return 'Password successfully changed. You can now log in with your new password.';
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.password !== dto.return_password) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.password) {
      throw new BadRequestException('This operation is only for users who have set a password');
    }

    const isOldPasswordCorrect = await bcrypt.compare(dto.old_password, user.password);
    if (!isOldPasswordCorrect) {
      throw new BadRequestException('Old password is incorrect');
    }

    await this.userRepo.findByIdAndUpdate(userId, {
      password: await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS),
    });

    return 'Password changed successfully';
  }

  // ─── Email Verification ────────────────────────────────

  async verifyEmail(id: string) {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.is_email_verified) {
      return 'Email already verified';
    }

    await this.userRepo.findByIdAndUpdate(id, { is_email_verified: true }, { new: true });
    return 'Your email has been successfully verified. Please log in to continue.';
  }

  // ─── Token Management ─────────────────────────────────

  async generateTokens(userId: Types.ObjectId) {
    const access_token = this.jwtService.sign({ userId: userId.toString() });
    const refresh_token = uuid();
    await this.storeRefreshToken(refresh_token, userId);
    return { access_token, refresh_token };
  }

  private async storeRefreshToken(token: string, userId: Types.ObjectId) {
    const refreshExpireDays = this.configService.get<number>('jwt.refreshExpiresDays', 7);
    const expiryDate = new Date(Date.now() + refreshExpireDays * 24 * 60 * 60 * 1000);

    return this.refreshTokenRepo.updateOne(
      { userId },
      { token, $set: { expiryDate } },
      { upsert: true },
    );
  }

  async refreshTokens(refreshToken: string) {
    const token = await this.refreshTokenRepo.findOne({
      token: refreshToken,
      expiryDate: { $gte: new Date() },
    });

    if (!token) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return this.generateTokens(token.userId);
  }
}
