import { registerAs } from '@nestjs/config';

export default registerAs('cloudinary', () => ({
  cloudName: process.env.CLOUD_NAME || '',
  apiKey: process.env.CLOUD_KEY || '',
  apiSecret: process.env.CLOUD_SECRET || '',
}));
