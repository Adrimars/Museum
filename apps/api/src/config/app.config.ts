import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  allowedOrigin: process.env['ALLOWED_ORIGIN'] ?? 'http://localhost:5173',
  rateLimitPublic: parseInt(process.env['RATE_LIMIT_PUBLIC'] ?? '100', 10),
  rateLimitAuthenticated: parseInt(process.env['RATE_LIMIT_AUTHENTICATED'] ?? '1000', 10),
}));
