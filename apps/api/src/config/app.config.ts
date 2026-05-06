import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  allowedOrigin: process.env['ALLOWED_ORIGIN'] ?? 'http://localhost:5173',

  // Rate limiting — per-group limits and windows
  rateLimitAuth: parseInt(process.env['RATE_LIMIT_AUTH'] ?? '10', 10),
  rateLimitAuthWindowMs: parseInt(process.env['RATE_LIMIT_AUTH_WINDOW_MS'] ?? '900000', 10),
  rateLimitPublic: parseInt(process.env['RATE_LIMIT_PUBLIC'] ?? '100', 10),
  rateLimitPublicWindowMs: parseInt(process.env['RATE_LIMIT_PUBLIC_WINDOW_MS'] ?? '60000', 10),
  rateLimitAuthenticated: parseInt(process.env['RATE_LIMIT_AUTHENTICATED'] ?? '300', 10),
  rateLimitAuthenticatedWindowMs: parseInt(process.env['RATE_LIMIT_AUTHENTICATED_WINDOW_MS'] ?? '60000', 10),
}));
