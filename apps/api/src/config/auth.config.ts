import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  jwtPrivateKey: process.env['JWT_PRIVATE_KEY']?.replace(/\\n/g, '\n') ?? '',
  jwtPublicKey: process.env['JWT_PUBLIC_KEY']?.replace(/\\n/g, '\n') ?? '',
  jwtAccessExpiry: process.env['JWT_ACCESS_EXPIRY'] ?? '15m',
  jwtRefreshExpiry: process.env['JWT_REFRESH_EXPIRY'] ?? '7d',
  bcryptCostFactor: parseInt(process.env['BCRYPT_COST_FACTOR'] ?? '12', 10),
  maxLoginAttempts: parseInt(process.env['MAX_LOGIN_ATTEMPTS'] ?? '5', 10),
  lockoutDurationMs: parseInt(process.env['LOCKOUT_DURATION_MS'] ?? '900000', 10), // 15 min
  googleClientId: process.env['GOOGLE_CLIENT_ID'] ?? '',
  googleClientSecret: process.env['GOOGLE_CLIENT_SECRET'] ?? '',
  googleCallbackUrl: process.env['GOOGLE_CALLBACK_URL'] ?? 'http://localhost:3000/api/v1/auth/google/callback',
  sendgridApiKey: process.env['SENDGRID_API_KEY'] ?? '',
  fromEmail: process.env['FROM_EMAIL'] ?? 'noreply@museumquest.app',
  frontendUrl: process.env['FRONTEND_URL'] ?? 'http://localhost:5173',
  passwordResetTtlMs: parseInt(process.env['PASSWORD_RESET_TTL_MS'] ?? '900000', 10), // 15 min
  guestTokenExpiry: process.env['GUEST_TOKEN_EXPIRY'] ?? '24h',
}));
