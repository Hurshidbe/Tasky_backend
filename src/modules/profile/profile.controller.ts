import {
  Controller,
  Get,
  Body,
  Patch,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Types } from 'mongoose';

import { ProfileService } from './profile.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { ProfileDto } from './dto/update-profile.dto.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@UseGuards(AuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get()
  findOwnProfile(@CurrentUser() userId: string) {
    return this.profileService.findProfile(new Types.ObjectId(userId));
  }

  @Patch()
  async update(
    @CurrentUser() userId: string,
    @Body() updateProfileDto: ProfileDto,
  ) {
    return this.profileService.updateProfile(updateProfileDto, new Types.ObjectId(userId));
  }

  @Patch('update-avatar')
  @UseInterceptors(FileInterceptor('photo'))
  async updateAvatar(
    @CurrentUser() userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }
    const imgUrl = await this.cloudinaryService.uploadOneImage(file);
    return this.profileService.updateAvatar(userId, imgUrl as string);
  }
}
