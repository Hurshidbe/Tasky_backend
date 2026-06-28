import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  uri: process.env.DB || 'mongodb://localhost:27017/tasky',
  autoIndex: true,
}));
