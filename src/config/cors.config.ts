import { registerAs } from '@nestjs/config';

export default registerAs('cors', () => ({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
}));
