import { BadGatewayException, BadRequestException, Injectable, Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TransformationType } from 'class-transformer';
import { v2 as cloudinary } from 'cloudinary'
import { error } from 'console';
import 'multer'
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  constructor(
    private config: ConfigService
  ) {
    cloudinary.config({
      cloud_name: config.get('CLOUD_NAME'),
      api_key: config.get('CLOUD_KEY'),
      api_secret: config.get('CLOUD_SECRET')
    })
  }

  async uploadOneImage(file: Express.Multer.File) {
    if (!file || !file.mimetype.startsWith('image/')) throw new BadRequestException('only image files alloved')
    if (file.size > 5 * 1024 ** 2) throw new BadRequestException('image size must be smaller than 5mb')

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'avatars&backgrounds',
          allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
          resource_type: "image",
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (error, result) => {
          if (error) return reject(error)
          if (!result || !result.secure_url) return reject(new Error('faylni yuklashda hatolik'))
          resolve(result.secure_url)
        }
      )
      Readable.from(file.buffer).pipe(uploadStream)
    })
  }
}
