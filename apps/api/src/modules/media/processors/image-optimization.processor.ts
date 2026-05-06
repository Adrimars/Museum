import { Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import sharp from 'sharp';

import { PrismaService } from '../../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import {
  IMAGE_OPTIMIZATION_QUEUE,
  type ImageOptimizationJob,
} from '../media.service';

// PRD §8.11.3 — three WebP variants
const VARIANTS = [
  { suffix: 'thumb', width: 400 },
  { suffix: 'medium', width: 1200 },
  { suffix: 'full', width: undefined }, // original dimensions
] as const;

@Processor(IMAGE_OPTIMIZATION_QUEUE)
export class ImageOptimizationProcessor {
  private readonly logger = new Logger(ImageOptimizationProcessor.name);

  constructor(
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Process()
  async handleOptimization(job: Job<ImageOptimizationJob>): Promise<void> {
    const { s3Key, museumId, artifactId, mimeType } = job.data;

    this.logger.log(`Starting image optimization for artifact ${artifactId} (key=${s3Key})`);

    let sourceBuffer: Buffer;
    try {
      sourceBuffer = await this.storage.getObjectBuffer(s3Key);
    } catch (err) {
      this.logger.error(`Could not fetch source image for ${artifactId}`, err);
      throw err;
    }

    const baseKey = `museums/${museumId}/artifacts/${artifactId}`;
    const mediaUrls: { url: string; type: string; variant: string }[] = [];

    for (const variant of VARIANTS) {
      let pipeline = sharp(sourceBuffer);

      if (variant.width) {
        pipeline = pipeline.resize(variant.width, undefined, { withoutEnlargement: true });
      }

      // S3-06: convert to WebP (PRD §8.11.3)
      const webpBuffer = await pipeline.webp({ quality: 85 }).toBuffer();
      const key = `${baseKey}/${variant.suffix}.webp`;

      // S3-07: CDN immutable cache headers set inside StorageService.putObject
      const url = await this.storage.putObject(key, webpBuffer, 'image/webp');

      mediaUrls.push({ url, type: 'image', variant: variant.suffix });
    }

    // Update artifact.media_urls with all three variant URLs.
    await this.prisma.artifact.update({
      where: { id: artifactId },
      data: { mediaUrls: mediaUrls },
    });

    this.logger.log(`Image optimization complete for artifact ${artifactId} — ${VARIANTS.length} variants`);
  }
}
