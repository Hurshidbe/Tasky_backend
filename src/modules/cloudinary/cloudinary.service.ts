import { BadGatewayException, BadRequestException, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import 'multer';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService implements OnModuleInit, OnModuleDestroy {
  private clockOffsetMs = 0;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(
    private config: ConfigService
  ) {
    cloudinary.config({
      cloud_name: config.get('CLOUD_NAME'),
      api_key: config.get('CLOUD_KEY'),
      api_secret: config.get('CLOUD_SECRET')
    });
  }

  async onModuleInit() {
    // Perform initial synchronization at startup
    console.log('[Cloudinary Sync] Initializing Clock Synchronization...');
    await this.calculateTimeOffset();

    // Set up periodic sync every 1 hour (3600000 ms) to account for system drift
    this.syncInterval = setInterval(() => {
      console.log('[Cloudinary Sync] Performing scheduled clock synchronization refresh...');
      this.calculateTimeOffset().catch((err) => {
        console.error('[Cloudinary Sync] Scheduled clock sync refresh failed:', err.message);
      });
    }, 3600000);
  }

  onModuleDestroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('[Cloudinary Sync] Cleared scheduled clock sync interval.');
    }
  }

  /**
   * Calculates the difference between current system time and absolute UTC time.
   * clockOffsetMs = Date.now() - adjustedRealTime
   * Corrected Time = Date.now() - clockOffsetMs
   */
  private async calculateTimeOffset(retryCount = 3): Promise<void> {
    const apis = [
      {
        url: 'https://timeapi.io/api/Time/current/zone?timeZone=UTC',
        parser: (data: any) => {
          if (!data || !data.dateTime) return NaN;
          // Ensure strictly parsed as UTC by appending 'Z' if timezone suffix is missing
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
            
            // Calculate absolute clock offset (positive or negative)
            this.clockOffsetMs = Date.now() - adjustedRealTime;
            
            console.log(`[Cloudinary Sync] Clock offset calculated: ${this.clockOffsetMs}ms (${(this.clockOffsetMs / 3600000).toFixed(4)} hours) via ${api.url}`);
            return; // Success
          }
        } catch (e: any) {
          console.warn(`[Cloudinary Sync] Failed to fetch time from ${api.url} (Attempt ${attempt}/${retryCount}):`, e.message);
        }
      }
      // Wait for 2 seconds with simple backoff before retrying
      if (attempt < retryCount) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    console.warn('[Cloudinary Sync] All Time APIs failed. Falling back to local system clock (offset = 0)');
    this.clockOffsetMs = 0;
  }

  /**
   * Uploads one image with file size and type validations.
   * Incorporates an active self-healing mechanism to recover from "Stale request" signature errors on drift.
   */
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
        console.warn('[Cloudinary Upload] Stale request / timestamp mismatch error detected. Activating self-healing...');
        try {
          // Re-synchronize clock offset immediately (fast 2-retry sync)
          await this.calculateTimeOffset(2);
          console.log('[Cloudinary Upload] Clock offset updated. Retrying upload...');
          return await this.executeUpload(file, true);
        } catch (retryError: any) {
          console.error('[Cloudinary Upload] Self-healing upload retry failed:', retryError);
          throw new BadGatewayException(`Cloudinary upload failed after self-healing: ${retryError.message || retryError}`);
        }
      }

      console.error('[Cloudinary Upload Error]:', error);
      throw new BadGatewayException(error.message || 'faylni yuklashda hatolik');
    }
  }

  /**
   * Executes the raw Cloudinary stream upload wrapped in a standard promise.
   */
  private executeUpload(file: Express.Multer.File, isRetry = false): Promise<string> {
    const localTimestamp = Date.now();
    const correctedTimestamp = Math.floor((localTimestamp - this.clockOffsetMs) / 1000);

    const prefix = isRetry ? '[Cloudinary Upload] [RETRY]' : '[Cloudinary Upload]';
    console.log(`${prefix} Local timestamp: ${localTimestamp}`);
    console.log(`${prefix} Corrected timestamp: ${correctedTimestamp}`);
    console.log(`${prefix} Offset applied: ${this.clockOffsetMs}ms`);

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
            console.error(`${prefix} Upload failed. Reason:`, error);
            return reject(error);
          }
          if (!result || !result.secure_url) {
            console.error(`${prefix} Upload failed. Reason: No secure URL returned from Cloudinary`);
            return reject(new Error('No secure URL returned from Cloudinary'));
          }
          console.log(`${prefix} Upload successful! URL: ${result.secure_url}`);
          resolve(result.secure_url);
        }
      );
      Readable.from(file.buffer).pipe(uploadStream);
    });
  }
}
