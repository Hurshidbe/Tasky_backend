import { 
  BadGatewayException, 
  BadRequestException, 
  Injectable, 
  OnModuleInit, 
  OnModuleDestroy,
  Logger 
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import 'multer';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CloudinaryService.name);
  private clockOffsetMs = 0;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: ConfigService,
  ) {
    cloudinary.config({
      cloud_name: config.get<string>('cloudinary.cloudName'),
      api_key: config.get<string>('cloudinary.apiKey'),
      api_secret: config.get<string>('cloudinary.apiSecret'),
    });
  }

  async onModuleInit() {
    this.logger.log('[Cloudinary Sync] Initializing Clock Synchronization...');
    await this.calculateTimeOffset();

    this.syncInterval = setInterval(() => {
      this.logger.log('[Cloudinary Sync] Performing scheduled clock synchronization refresh...');
      this.calculateTimeOffset().catch((err) => {
        this.logger.error('[Cloudinary Sync] Scheduled clock sync refresh failed:', err.message);
      });
    }, 3600000);
  }

  onModuleDestroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.logger.log('[Cloudinary Sync] Cleared scheduled clock sync interval.');
    }
  }

  private async calculateTimeOffset(retryCount = 3): Promise<void> {
    const apis = [
      {
        url: 'https://timeapi.io/api/Time/current/zone?timeZone=UTC',
        parser: (data: any) => {
          if (!data || !data.dateTime) return NaN;
          const dtStr = data.dateTime.endsWith('Z') ? data.dateTime : data.dateTime + 'Z';
          return new Date(dtStr).getTime();
        },
      },
      {
        url: 'http://worldtimeapi.org/api/timezone/Etc/UTC',
        parser: (data: any) => {
          if (!data) return NaN;
          if (typeof data.unixtime === 'number') {
            return data.unixtime * 1000;
          }
          if (data.utc_datetime) {
            return new Date(data.utc_datetime).getTime();
          }
          return NaN;
        },
      },
    ];

    for (let attempt = 1; attempt <= retryCount; attempt++) {
      for (const api of apis) {
        try {
          const start = Date.now();
          const res = await fetch(api.url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          
          const data = await res.json();
          const realUtcTime = api.parser(data);
          
          if (!isNaN(realUtcTime)) {
            const latency = (Date.now() - start) / 2;
            const adjustedRealTime = realUtcTime + latency;
            
            this.clockOffsetMs = Date.now() - adjustedRealTime;
            this.logger.log(`[Cloudinary Sync] Clock offset calculated: ${this.clockOffsetMs}ms (${(this.clockOffsetMs / 3600000).toFixed(4)} hours) via ${api.url}`);
            return;
          }
        } catch (e: any) {
          this.logger.warn(`[Cloudinary Sync] Failed to fetch time from ${api.url} (Attempt ${attempt}/${retryCount}): ${e.message}`);
        }
      }
      if (attempt < retryCount) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    this.logger.warn('[Cloudinary Sync] All Time APIs failed. Falling back to local system clock (offset = 0)');
    this.clockOffsetMs = 0;
  }

  async uploadOneImage(file: Express.Multer.File): Promise<string> {
    if (!file || !file.mimetype.startsWith('image/')) {
      throw new BadRequestException('only image files allowed');
    }
    if (file.size > 5 * 1024 ** 2) {
      throw new BadRequestException('image size must be smaller than 5mb');
    }

    try {
      return await this.executeUpload(file, false);
    } catch (error: any) {
      const errorStr = (error?.message || '').toLowerCase();
      const isStaleRequest = errorStr.includes('stale request') || 
                            errorStr.includes('timestamp') || 
                            JSON.stringify(error).toLowerCase().includes('stale');

      if (isStaleRequest) {
        this.logger.warn('[Cloudinary Upload] Stale request / timestamp mismatch error detected. Activating self-healing...');
        try {
          await this.calculateTimeOffset(2);
          this.logger.log('[Cloudinary Upload] Clock offset updated. Retrying upload...');
          return await this.executeUpload(file, true);
        } catch (retryError: any) {
          this.logger.error('[Cloudinary Upload] Self-healing upload retry failed:', retryError);
          throw new BadGatewayException(`Cloudinary upload failed after self-healing: ${retryError.message || retryError}`);
        }
      }

      this.logger.error('[Cloudinary Upload Error]:', error);
      throw new BadGatewayException(error.message || 'faylni yuklashda hatolik');
    }
  }

  private executeUpload(file: Express.Multer.File, isRetry = false): Promise<string> {
    const localTimestamp = Date.now();
    const correctedTimestamp = Math.floor((localTimestamp - this.clockOffsetMs) / 1000);

    const prefix = isRetry ? '[Cloudinary Upload] [RETRY]' : '[Cloudinary Upload]';
    this.logger.log(`${prefix} Local timestamp: ${localTimestamp} | Corrected: ${correctedTimestamp} | Offset: ${this.clockOffsetMs}ms`);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'avatars-backgrounds',
          allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
          timestamp: correctedTimestamp,
        },
        (error, result) => {
          if (error) {
            this.logger.error(`${prefix} Upload failed: ${error.message || JSON.stringify(error)}`);
            return reject(error);
          }
          if (!result || !result.secure_url) {
            this.logger.error(`${prefix} Upload failed: No secure URL returned from Cloudinary`);
            return reject(new Error('No secure URL returned from Cloudinary'));
          }
          this.logger.log(`${prefix} Upload successful! URL: ${result.secure_url}`);
          resolve(result.secure_url);
        }
      );
      Readable.from(file.buffer).pipe(uploadStream);
    });
  }
}
