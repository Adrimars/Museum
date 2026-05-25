import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly cdnBaseUrl: string;
  private readonly presignExpiry: number;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.get<string>('aws.s3Bucket', 'museumquest-media');
    this.cdnBaseUrl = config.get<string>('aws.cdnBaseUrl', '');
    this.presignExpiry = config.get<number>('aws.presignExpiry', 300);

    this.client = new S3Client({
      region: config.get<string>('aws.region', 'eu-central-1'),
      credentials: {
        accessKeyId: config.get<string>('aws.accessKeyId', ''),
        secretAccessKey: config.get<string>('aws.secretAccessKey', ''),
      },
    });
  }

  // ── Server-side PUT (used by QR code generation) ──────────────────────────

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
    // S3-07: Cloudflare CDN — immutable cache headers for hashed keys (PRD §8.11.4)
    cacheControl = 'max-age=31536000, immutable',
  ): Promise<string> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: cacheControl,
        }),
      );
      return this.buildCdnUrl(key);
    } catch (err) {
      this.logger.error('S3 putObject failed', { key, err });
      throw new InternalServerErrorException('Failed to upload file to storage.');
    }
  }

  // ── Pre-signed POST (client uploads directly to S3) ───────────────────────

  async createPresignedPost(
    key: string,
    contentType: string,
    maxSizeBytes: number,
  ): Promise<{ uploadUrl: string; fields: Record<string, string>; cdnUrl: string; expiresIn: number }> {
    try {
      const { url, fields } = await createPresignedPost(this.client, {
        Bucket: this.bucket,
        Key: key,
        Conditions: [
          ['content-length-range', 1, maxSizeBytes],
          ['eq', '$Content-Type', contentType],
          // S3-07: set immutable cache header on client-uploaded assets
          ['eq', '$Cache-Control', 'max-age=31536000, immutable'],
        ],
        Fields: {
          'Content-Type': contentType,
          'Cache-Control': 'max-age=31536000, immutable',
        },
        Expires: this.presignExpiry,
      });

      return {
        uploadUrl: url,
        fields: fields as Record<string, string>,
        cdnUrl: this.buildCdnUrl(key),
        expiresIn: this.presignExpiry,
      };
    } catch (err) {
      this.logger.error('S3 createPresignedPost failed', { key, err });
      throw new InternalServerErrorException('Failed to generate upload URL.');
    }
  }

  // ── Server-side GET (used by image optimization processor) ───────────────

  async getObjectBuffer(key: string): Promise<Buffer> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const stream = response.Body;
      if (!stream) throw new Error('Empty S3 response body');
      const chunks: Uint8Array[] = [];
      for await (const chunk of stream as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (err) {
      this.logger.error('S3 getObjectBuffer failed', { key, err });
      throw new InternalServerErrorException('Failed to retrieve file from storage.');
    }
  }

  // ── Pre-signed GET URL (used for bulk QR ZIP download) ───────────────────

  async getPresignedGetUrl(key: string, expiresIn = 3_600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  // ── Delete object ─────────────────────────────────────────────────────────

  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      this.logger.error('S3 deleteObject failed', { key, err });
      throw new InternalServerErrorException('Failed to delete file from storage.');
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  buildCdnUrl(key: string): string {
    if (this.cdnBaseUrl) {
      return `${this.cdnBaseUrl.replace(/\/$/, '')}/${key}`;
    }
    // Fallback to direct S3 URL in development (no CDN configured)
    const region = this.config.get<string>('aws.region', 'eu-central-1');
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
  }
}
