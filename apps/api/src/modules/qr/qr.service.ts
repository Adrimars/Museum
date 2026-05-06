import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

import {
  BadRequestException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';

import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { QrHmacKey } from '../../config/qr.config';

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);
  private readonly keys: QrHmacKey[];
  private readonly activeKey: QrHmacKey;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {
    this.keys = this.config.get<QrHmacKey[]>('qr.keys', []);
    const active = this.config.get<QrHmacKey>('qr.activeKey');
    if (!active) throw new Error('No active QR HMAC key configured');
    this.activeKey = active;
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

  async deactivate(id: string) {
    const qr = await this.prisma.qrCode.findUnique({ where: { id } });

    if (!qr) {
      throw new NotFoundException({
        message: 'QR code not found.',
        errorCode: ErrorCode.QR_NOT_FOUND,
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

  // ── Private helpers ───────────────────────────────────────────────────────

  private resolveKey(kid: string): QrHmacKey | undefined {
    return this.keys.find((k) => k.kid === kid);
  }
}
