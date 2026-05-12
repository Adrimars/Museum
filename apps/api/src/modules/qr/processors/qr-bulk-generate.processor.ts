import { Readable, PassThrough } from 'node:stream';

import { Logger, Inject } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import type Redis from 'ioredis';
import * as archiver from 'archiver';
import * as QRCode from 'qrcode';

import { PrismaService } from '../../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { REDIS_CLIENT } from '../../../redis/redis.module';

export const QR_BULK_GENERATE_QUEUE = 'qr-bulk-generate';

export interface QrBulkGenerateJob {
  museumId: string;
}

// Pre-signed GET URL valid for 24 hours (PRD §8.4.4 — "available for download").
const DOWNLOAD_URL_TTL_SECONDS = 86_400;

@Processor(QR_BULK_GENERATE_QUEUE)
export class QrBulkGenerateProcessor {
  private readonly logger = new Logger(QrBulkGenerateProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Process()
  async handle(job: Job<QrBulkGenerateJob>): Promise<void> {
    const { museumId } = job.data;
    this.logger.log(`Starting bulk QR generation for museum ${museumId} (job=${job.id})`);

    // 1. Fetch all active QR codes for the museum whose artifact is not soft-deleted.
    const qrCodes = await this.prisma.qrCode.findMany({
      where: {
        museumId,
        isActive: true,
        artifact: { deletedAt: null },
      },
      include: { artifact: { select: { name: true } } },
    });

    if (qrCodes.length === 0) {
      this.logger.warn(`No active QR codes found for museum ${museumId}`);
      return;
    }

    // 2. Build ZIP in memory using archiver.
    const passThrough = new PassThrough();
    const archive = archiver.default('zip', { zlib: { level: 9 } });

    archive.pipe(passThrough);

    // Regenerate each QR PNG from stored code_hash + kid (avoids S3 reads).
    for (const qr of qrCodes) {
      const qrUrl = `/scan/${qr.museumId}/${qr.artifactId}?codeHash=${qr.codeHash}&kid=${qr.kid}`;
      const pngBuffer = await QRCode.toBuffer(qrUrl, {
        type: 'png',
        errorCorrectionLevel: 'H',
        width: 512,
      });
      const safeName = (qr.artifact?.name ?? qr.artifactId).replace(/[^\w-]/g, '_');
      archive.append(Readable.from(pngBuffer), { name: `${safeName}.png` });
    }

    await archive.finalize();

    // Collect streamed ZIP chunks into one buffer.
    const chunks: Buffer[] = [];
    for await (const chunk of passThrough) {
      chunks.push(chunk as Buffer);
    }
    const zipBuffer = Buffer.concat(chunks);

    // 3. Upload ZIP to S3.
    const s3Key = `museums/${museumId}/qr/bulk/${String(job.id)}.zip`;
    await this.storage.putObject(s3Key, zipBuffer, 'application/zip', 'no-cache, no-store');

    // 4. Generate pre-signed GET URL (PRD §8.4.4 — "available via a pre-signed S3 URL").
    const downloadUrl = await this.storage.getPresignedGetUrl(s3Key, DOWNLOAD_URL_TTL_SECONDS);

    // 5. Store result in Redis so the status endpoint can return it.
    await this.redis.set(
      `qr:bulk:${String(job.id)}:result`,
      downloadUrl,
      'EX',
      DOWNLOAD_URL_TTL_SECONDS,
    );

    this.logger.log(
      `Bulk QR ZIP uploaded for museum ${museumId} — ${qrCodes.length} codes (job=${job.id})`,
    );
  }
}
