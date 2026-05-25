import { registerAs } from '@nestjs/config';

export default registerAs('analytics', () => ({
  hmacSalt: process.env['ANALYTICS_HMAC_SALT'] ?? 'museumquest-analytics-salt',
}));
