import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import * as QRCode from 'qrcode';

import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { StorageService } from '../storage/storage.service';
import type { QrHmacKey } from '../../config/qr.config';
import {
  QR_BULK_GENERATE_QUEUE,
  type QrBulkGenerateJob,
} from './processors/qr-bulk-generate.processor';
import type { BulkGenerateQrDto } from './dto/bulk-generate-qr.dto';

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);
  // PRD §8.4.3 — keep only the 2 most recent secrets for validation.
  private readonly validKeys: QrHmacKey[];
  private readonly activeKey: QrHmacKey;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    @InjectQueue(QR_BULK_GENERATE_QUEUE) private readonly bulkQueue: Queue<QrBulkGenerateJob>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    const allKeys = this.config.get<QrHmacKey[]>('qr.keys', []);
    // Slice to the 2 most recent entries (last in array = newest).
    this.validKeys = allKeys.slice(-2);
    const active = this.config.get<QrHmacKey>('qr.activeKey');
    if (!active) throw new Error('No active QR HMAC key configured');
    this.activeKey = active;

    if (allKeys.length > 2) {
      this.logger.warn(
        `QR_HMAC_SECRETS has ${allKeys.length} keys; only the 2 most recent (${this.validKeys.map((k) => k.kid).join(', ')}) are accepted for validation`,
      );
    }
  }

  // ── Auto-generate QR on artifact creation (PRD §8.4.1) ───────────────────

  async generateForArtifact(museumId: string, artifactId: string): Promise<void> {
    // 1. Build canonical payload and HMAC-SHA256 signature.
    const canonical = `${museumId}:${artifactId}`;
    const sig = createHmac('sha256', this.activeKey.secret)
      .update(canonical)
      .digest('hex');

    // 2. code_hash = SHA-256 of (sig:kid) — stored in DB for instant B-tree lookup.
    const codeHash = createHash('sha256')
      .update(`${sig}:${this.activeKey.kid}`)
      .digest('hex');

    // 3. QR URL per PRD §8.4.1 — embeds codeHash and kid so client can send both to /validate.
    const qrUrl = `/scan/${museumId}/${artifactId}?codeHash=${codeHash}&kid=${this.activeKey.kid}`;

    // 4. Render QR PNG via `qrcode` npm package.
    const pngBuffer: Buffer = await QRCode.toBuffer(qrUrl, {
      type: 'png',
      errorCorrectionLevel: 'H',
      width: 512,
    });

    // 5. Upload to S3 under museums/{museumId}/qr/{artifactId}.png (PRD §8.4.1).
    const s3Key = `museums/${museumId}/qr/${artifactId}.png`;
    const imageUrl = await this.storage.putObject(s3Key, pngBuffer, 'image/png');

    // 6. Persist qr_codes record (PRD §8.4.1).
    await this.prisma.qrCode.create({
      data: {
        museumId,
        artifactId,
        codeHash,
        kid: this.activeKey.kid,
        imageUrl,
        scanCount: 0,
        isActive: true,
      },
    });

    this.logger.log(`QR generated for artifact ${artifactId} (kid=${this.activeKey.kid})`);
  }

  // ── Validate a scanned QR code (PRD §8.4.2) ──────────────────────────────

  async validate(codeHash: string, kid: string) {
    // 1. Look up by code_hash (B-tree index — O(1) lookup per PRD §12.5).
    const qr = await this.prisma.qrCode.findUnique({
      where: { codeHash },
      include: {
        artifact: {
          select: {
            id: true,
            museumId: true,
            name: true,
            description: true,
            period: true,
            locationHint: true,
            mediaUrls: true,
            audioGuideUrl: true,
            audioTranscript: true,
            metadata: true,
            suggestedQuestions: true,
          },
        },
      },
    });

    if (!qr) {
      throw new NotFoundException({
        message: 'QR code not found.',
        errorCode: ErrorCode.QR_NOT_FOUND,
      });
    }

    // 2. Resolve the HMAC key by kid — validates against the kid embedded in the scanned URL.
    const key = this.resolveKey(kid);
    if (!key) {
      throw new BadRequestException({
        message: 'Unknown key identifier in QR code.',
        errorCode: ErrorCode.QR_INVALID_SIGNATURE,
      });
    }

    // 3. Verify HMAC-SHA256 signature (PRD §8.4.2 step 2).
    const canonical = `${qr.museumId}:${qr.artifactId}`;
    const expectedSig = createHmac('sha256', key.secret).update(canonical).digest('hex');
    const expectedHash = createHash('sha256')
      .update(`${expectedSig}:${kid}`)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedHash, 'hex');
    const actualBuf = Buffer.from(codeHash, 'hex');
    if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
      throw new UnprocessableEntityException({
        message: 'QR code signature is invalid.',
        errorCode: ErrorCode.QR_INVALID_SIGNATURE,
      });
    }

    // 4. Check active status (PRD §8.4.2 step 4).
    if (!qr.isActive) {
      throw new GoneException({
        message: 'This QR code has been deactivated.',
        errorCode: ErrorCode.QR_DEACTIVATED,
      });
    }

    // 5. Increment scan_count atomically (PRD §8.4.2 step 5).
    await this.prisma.qrCode.update({
      where: { codeHash },
      data: { scanCount: { increment: 1 } },
    });

    // Step 6 (emit analytics event) will be implemented in Sprint 7's AnalyticsModule.

    return { qrId: qr.id, artifact: qr.artifact, scanCount: qr.scanCount + 1 };
  }

  // ── Deactivate a QR code (PRD §8.4.4) ────────────────────────────────────

  async deactivate(id: string, actor: JwtPayload) {
    const qr = await this.prisma.qrCode.findUnique({ where: { id } });

    if (!qr) {
      throw new NotFoundException({
        message: 'QR code not found.',
        errorCode: ErrorCode.QR_NOT_FOUND,
      });
    }

    if (actor.role !== 'super_admin' && actor.museumId !== qr.museumId) {
      throw new ForbiddenException({
        message: 'You can only manage QR codes within your own museum.',
        errorCode: ErrorCode.FORBIDDEN,
      });
    }

    return this.prisma.qrCode.update({ where: { id }, data: { isActive: false } });
  }

  // ── Get single QR record ──────────────────────────────────────────────────

  async findById(id: string) {
    const qr = await this.prisma.qrCode.findUnique({ where: { id } });

    if (!qr) {
      throw new NotFoundException({
        message: 'QR code not found.',
        errorCode: ErrorCode.QR_NOT_FOUND,
      });
    }

    return qr;
  }

  // ── Bulk-generate QR codes (PRD §8.4.4) ──────────────────────────────────

  async bulkGenerate(dto: BulkGenerateQrDto, actor: JwtPayload): Promise<{ jobId: string }> {
    const museumId = actor.role === 'super_admin' ? dto.museumId : actor.museumId;

    if (!museumId) {
      throw new BadRequestException({
        message: 'museumId is required.',
        errorCode: ErrorCode.VALIDATION_ERROR,
      });
    }

    if (actor.role === 'museum_admin' && actor.museumId !== museumId) {
      throw new ForbiddenException({
        message: 'You can only bulk-generate QR codes for your own museum.',
        errorCode: ErrorCode.FORBIDDEN,
      });
    }

    const job = await this.bulkQueue.add(
      { museumId },
      { attempts: 2, backoff: { type: 'exponential', delay: 5_000 } },
    );

    return { jobId: String(job.id) };
  }

  // ── Bulk-generate status / download URL ──────────────────────────────────

  async getBulkGenerateResult(jobId: string, actor: JwtPayload): Promise<{ status: string; downloadUrl?: string }> {
    const job = await this.bulkQueue.getJob(jobId);

    if (!job) {
      throw new NotFoundException({
        message: 'Bulk generate job not found.',
        errorCode: ErrorCode.QR_NOT_FOUND,
      });
    }

    // Enforce museum ownership: non-super_admin may only read their own job.
    const jobMuseumId = (job.data as QrBulkGenerateJob).museumId;
    if (actor.role !== 'super_admin' && actor.museumId !== jobMuseumId) {
      throw new ForbiddenException({
        message: 'You can only check bulk generate jobs for your own museum.',
        errorCode: ErrorCode.FORBIDDEN,
      });
    }

    const state = await job.getState();

    if (state !== 'completed') {
      return { status: state };
    }

    const downloadUrl = await this.redis.get(`qr:bulk:${jobId}:result`);
    const result: { status: string; downloadUrl?: string } = { status: 'completed' };
    if (downloadUrl) result.downloadUrl = downloadUrl;
    return result;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  // Only the 2 most recent keys are valid (PRD §8.4.3).
  private resolveKey(kid: string): QrHmacKey | undefined {
    return this.validKeys.find((k) => k.kid === kid);
  }
}
