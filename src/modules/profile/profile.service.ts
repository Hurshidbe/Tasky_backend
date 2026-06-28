import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../auth/schema/auth.schema.js';
import { ProfileDto } from './dto/update-profile.dto.js';

@Injectable()
export class ProfileService {
  constructor(
    @InjectModel(User.name) private readonly userRepo: Model<User>,
  ) {}

  async findProfile(userId: Types.ObjectId) {
    const user = await this.userRepo.findById(userId).select('-password');
    if (!user) {
      throw new UnauthorizedException('User profile not found');
    }
    return user;
  }

  async updateProfile(dto: ProfileDto, userId: Types.ObjectId) {
    const user = await this.userRepo.findById(userId).select('-password');
    if (!user) {
      throw new UnauthorizedException('User profile not found');
    }

    if (dto.username) {
      const existingUser = await this.userRepo.findOne({
        username: { $regex: new RegExp(`^${dto.username}$`, 'i') },
        _id: { $ne: userId },
      });
      if (existingUser) {
        throw new BadRequestException('This username is already taken. Please choose another one.');
      }
    }

    return this.userRepo
      .findByIdAndUpdate(userId, { ...dto }, { returnDocument: 'after' })
      .select('-password');
  }

  async updateAvatar(userId: string, imgUrl: string) {
    return this.userRepo
      .findByIdAndUpdate(userId, { avatar: imgUrl }, { returnDocument: 'after' })
      .select('-password');
  }
}
