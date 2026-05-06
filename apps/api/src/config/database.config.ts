import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env['DATABASE_URL'] ?? 'postgresql://museumquest:museumquest@localhost:5432/museumquest',
}));
