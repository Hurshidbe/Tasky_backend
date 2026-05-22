import { BadRequestException, HttpException, Inject, Injectable, Type, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Auth } from './schema/auth.schema';
import { Model, Types } from 'mongoose';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt'
import { JwtService } from '@nestjs/jwt';
import {v4 as  uuid} from 'uuid'
import { RefreshToken } from './schema/refreshToken.schema';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Profile, use } from 'passport';
import { MailService } from '../nodeMailer/mailer.service';
import { types } from 'util';
import { identity, throwError } from 'rxjs';
import { ChangePasswordDto,  SetPasswordDto } from './dto/setAndChangePassword.dto';
import { ConfigService } from '@nestjs/config';
import { ResetPass } from './schema/resetPass.schema';
import { Mode } from 'fs';

@Injectable()
export class AuthService {
    constructor(
        @InjectModel(Auth.name) private readonly AuthRepo : Model<Auth>,
        @InjectModel(RefreshToken.name) private readonly RefreshTokenRepo : Model<RefreshToken>,
        @InjectModel(ResetPass.name) private readonly ResetPassRequestsRepo : Model<ResetPass>,
        @Inject(CACHE_MANAGER) private readonly CacheManager:Cache,
        private readonly jwt : JwtService,
        private readonly mailService : MailService,
        private readonly configService : ConfigService
    ){}

    async register(dto : RegisterDto){
          if(dto.password!==dto.return_password) throw new BadRequestException('passwords does not match')
          const email = dto.email.toLowerCase().trim();
          if((await this.AuthRepo.findOne({ email }))) throw new BadRequestException('email already registered')
            const hashed_pass = await bcrypt.hash(dto.password,12)
            const user = await this.AuthRepo.create(
                {
                    email : email,
                    password : hashed_pass,
                    firstname : email.split('@')[0]
                }
            )
        return {
            status : 'success',
            created : user
        }
    }

    async registerOrLoginWithGoogle(data: Profile) {
        const user = {
            google_id: data.id,
            email: data.emails?.[0]?.value.toLowerCase().trim(),
            name: data.name?.givenName,
            avatar: data.photos?.[0]?.value
        };
        
        let isRegistered = await this.AuthRepo.findOne({ email: user.email });
        if (!isRegistered) {
            const newUser = await this.AuthRepo.create({
                google_id: user.google_id,
                email: user.email,
                firstname: user.name,
                avatar: user.avatar,
                is_email_verified: true,
                password: null
            });
            
            return this.generateTokens(newUser._id);
        } else {
            if (!isRegistered.google_id ||!isRegistered.is_email_verified) {
                isRegistered = await this.AuthRepo.findByIdAndUpdate(
                    isRegistered._id,
                    { $set: { google_id: user.google_id, is_email_verified: true } },
                    { returnDocument : 'after' }
                )
            }
            if (!isRegistered) throw new UnauthorizedException('User not found');
        }

  return this.generateTokens(isRegistered._id);
}

    async loginWithEmail(dto: LoginDto) {
        const key = `login_attemps:${dto.email}`;
        const attemps = (await this.CacheManager.get<number>(key)) ?? 0;
        if (attemps >= 5) {
            throw new UnauthorizedException('Too many attemps, try again after 2 minutes');
        }
        const email = dto.email.toLowerCase().trim();
        const user = await this.AuthRepo.findOne({ email });
        const pass_match = user? await bcrypt.compare(dto.password, user.password as string) : false;
        if (!user || !pass_match) {
            await this.CacheManager.set(key, attemps + 1, 120000);
            throw new UnauthorizedException(`Incorrect email/password`);
        }

        if(!user.is_email_verified){
            await this.mailService.sendActivateEmail(user._id, user.email)
            throw new UnauthorizedException(`Before logging in, please verify your email. We've sent a verification link to your email address. Can't see the email? Check your spam or junk folder.`)
        }
        await this.CacheManager.del(key);
        return await this.generateTokens(user._id);
    }

    async sendResetPassLinkToViaNodemailer(email : string){
        const user = await this.AuthRepo.findOne({email : email})
        if(!user) throw new BadRequestException(`bunday email saytda royhatdan o'tmagan`);
        await this.ResetPassRequestsRepo.findByIdAndDelete(user._id)
        await this.ResetPassRequestsRepo.create({user : user._id, used : false})
        return await this.mailService.sendResetPasswordLink(user._id, user.email)
    }


    async setPassword(userId : string, dto : SetPasswordDto){
        if(dto.password !== dto.return_password) throw new BadRequestException('passwords not same')
        const user = await this.AuthRepo.findById(userId)
        if(!user) throw new BadRequestException('user not found')
        if(user.google_id){
            await this.AuthRepo.findByIdAndUpdate(userId, {password : await bcrypt.hash(dto.password,12)})
            return 'password successfully created'
        } else {
            throw new UnauthorizedException('This operation is only for Google-logged users who have not set a password')
        }
    }

    async resetPassword(userId : string, dto : SetPasswordDto){
        if(dto.password!==dto.return_password) throw new UnauthorizedException('passwords do not match')
        const resetRequest = await this.ResetPassRequestsRepo.findOne({user:new Types.ObjectId(userId), used : false, expire : {$gte: new Date()}});
        if (!resetRequest) {throw new BadRequestException('link invalid or expired')}
        await this.AuthRepo.findByIdAndUpdate(userId, {password : await bcrypt.hash(dto.password, 12)})
        resetRequest.used=true
        await resetRequest.save()
        return 'password successfully changed, Now you can relogin'
    }

    async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.password !== dto.return_password)
        throw new BadRequestException('Passwords do not match')
    const user= await this.AuthRepo.findById(userId);
    if (!user) throw new BadRequestException('User not found')
    if(!user.password) throw new BadRequestException('This operation is only for users who have set a password')
    const isMatch = await bcrypt.compare(dto.old_password, user.password!)
    if (!isMatch) throw new BadRequestException('Old password is incorrect')

    const hashedPassword = await bcrypt.hash(dto.password, 12)
    await this.AuthRepo.findByIdAndUpdate(userId, { password: hashedPassword })
    return 'Password changed successfully'
}

    async verifyEmail(id : string){
        const user = await this.AuthRepo.findById(id)
        if(!user) throw new BadRequestException('user not found')
        if(user.is_email_verified) return 'email already verified'
        await this.AuthRepo.findByIdAndUpdate(id, {is_email_verified : true}, {new : true})
        return 'your email successfully verified, please relogin and enjoy'
    }

    async generateTokens(userId : Types.ObjectId){
        const access_token = this.jwt.sign({ userId: userId.toString() })
        const refresh_token = uuid()
        await this.storeRefreshToken(refresh_token, userId)
        return {access_token, refresh_token}
    }

    async storeRefreshToken(token : string , userId : Types.ObjectId){
        return await this.RefreshTokenRepo.updateOne({userId}, {token, $set :{expiryDate : Date.now()+(7*24*60**2*1000)}},{upsert : true})
    }

    async refreshAll(refresh_token : string){
        const token = await this.RefreshTokenRepo.findOne(
            {token : refresh_token, expiryDate : {$gte : new Date()}}
        )
        if(!token) throw new UnauthorizedException()
            return await this.generateTokens(token.userId)
    }
}
