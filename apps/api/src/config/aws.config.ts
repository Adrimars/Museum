import { registerAs } from '@nestjs/config';

export default registerAs('aws', () => ({
  region: process.env['AWS_REGION'] ?? 'eu-central-1',
  accessKeyId: process.env['AWS_ACCESS_KEY_ID'] ?? '',
  secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] ?? '',
  s3Bucket: process.env['AWS_S3_BUCKET'] ?? 'museumquest-media',
  // CDN base URL — Cloudflare in front of S3 (S3-07)
  cdnBaseUrl: process.env['CDN_BASE_URL'] ?? '',
  // Pre-signed URL TTL in seconds (PRD §8.11.1: 5 minutes)
  presignExpiry: 300,
}));
