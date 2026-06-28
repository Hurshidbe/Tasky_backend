import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  host: 'smtp.gmail.com',
  user: process.env.MAIL || '',
  pass: process.env.MAIL_PASS || '',
  verifyLink: process.env.EMAIL_VERIFY_LINK || 'http://localhost:3000/auth/verify',
}));
