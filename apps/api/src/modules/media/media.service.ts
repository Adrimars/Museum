import * as path from 'node:path';

import { InjectQueue } from '@nestjs/bull';
import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bull';
import { v4 as uuidv4 } from 'uuid';

import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { ErrorCode } from '../../common/errors/error-codes';
import { StorageService } from '../storage/storage.service';

import {
  ACCEPTED_MIME_TYPES,
  MAX_SIZES,
  type PresignDto,
  type UploadContext,
} from './dto/presign.dto';

export const IMAGE_OPTIMIZATION_QUEUE = 'image-optimization';

export interface ImageOptimizationJob {
  s3Key: string;
  museumId: string;
  artifactId: string;
  mimeType: string;
}

const AUDIO_CONTEXTS: UploadContext[] = ['audio_guide'];
const IMAGE_CONTEXTS: UploadContext[] = ['avatar', 'artifact_image', 'reward_asset'];

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly storage: StorageService,
    @InjectQueue(IMAGE_OPTIMIZATION_QUEUE) private readonly imageQueue: Queue<ImageOptimizationJob>,
  ) {}

  // ── POST /media/presign (PRD §8.11) ───────────────────────────────────────

  async presign(dto: PresignDto, actor: JwtPayload) {
    // Enforce museumId/artifactId presence for museum-scoped contexts
    const museumScopedContexts: UploadContext[] = ['artifact_image', 'audio_guide', 'reward_asset'];
    const artifactScopedContexts: UploadContext[] = ['artifact_image', 'audio_guide'];

    if (museumScopedContexts.includes(dto.context)) {
      if (!dto.museumId) {
        throw new BadRequestException({
          message: `museumId is required for the ${dto.context} context.`,
          errorCode: ErrorCode.VALIDATION_ERROR,
        });
      }
      if (actor.role !== 'super_admin' && actor.museumId !== dto.museumId) {
        throw new ForbiddenException({
          message: 'You can only upload assets to your own museum.',
          errorCode: ErrorCode.FORBIDDEN,
        });
      }
    }

    if (artifactScopedContexts.includes(dto.context) && !dto.artifactId) {
      throw new BadRequestException({
        message: `artifactId is required for the ${dto.context} context.`,
        errorCode: ErrorCode.VALIDATION_ERROR,
      });
    }

    // S3-08: validate MIME type against accepted list (PRD §8.11.2)
    if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(dto.mimeType)) {
      throw new BadRequestException({
        message: `File type "${dto.mimeType}" is not accepted.`,
        errorCode: ErrorCode.MEDIA_INVALID_TYPE,
      });
    }

    // S3-08: validate file size against per-context limit (PRD §8.11.2)
    const maxBytes = MAX_SIZES[dto.context];
    if (dto.fileSize > maxBytes) {
      throw new BadRequestException({
        message: `File size exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit for ${dto.context}.`,
        errorCode: ErrorCode.MEDIA_FILE_TOO_LARGE,
      });
    }

    // Validate audio type is only used with audio contexts
    const isAudio = dto.mimeType.startsWith('audio/');
    if (isAudio && !AUDIO_CONTEXTS.includes(dto.context)) {
      throw new BadRequestException({
        message: 'Audio files are only accepted for the audio_guide context.',
        errorCode: ErrorCode.MEDIA_INVALID_TYPE,
      });
    }
    if (!isAudio && AUDIO_CONTEXTS.includes(dto.context)) {
      throw new BadRequestException({
        message: 'The audio_guide context only accepts audio files.',
        errorCode: ErrorCode.MEDIA_INVALID_TYPE,
      });
    }

    const s3Key = this.buildS3Key(dto, actor);
    const result = await this.storage.createPresignedPost(s3Key, dto.mimeType, maxBytes);

    // S3-06: for image uploads, enqueue the optimization job after client completes upload.
    // The client must call the presign endpoint first; the queue job will run once the file is uploaded.
    // (In a production system, an S3 event notification would trigger this; for Sprint 3, we pre-enqueue.)
    if (IMAGE_CONTEXTS.includes(dto.context) && dto.artifactId && dto.museumId) {
      await this.imageQueue.add(
        {
          s3Key,
          museumId: dto.museumId,
          artifactId: dto.artifactId,
          mimeType: dto.mimeType,
        },
        {
          delay: 10_000, // 10 s grace period for the client upload to complete
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: true,
        },
      );
    }

    return result;
  }

  // ── DELETE /media/:key ────────────────────────────────────────────────────

  async deleteAsset(key: string, actor: JwtPayload): Promise<{ message: string }> {
    // Reject keys with traversal patterns before any path parsing
    if (key.includes('..') || key.startsWith('/')) {
      throw new BadRequestException({
        message: 'Invalid asset key.',
        errorCode: ErrorCode.FORBIDDEN,
      });
    }

    // Only museum-scoped paths are deletable via this endpoint
    const museumMatch = /^museums\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i.exec(key);
    if (!museumMatch) {
      throw new BadRequestException({
        message: 'Invalid asset key format.',
        errorCode: ErrorCode.FORBIDDEN,
      });
    }

    if (actor.role !== 'super_admin' && actor.museumId !== museumMatch[1]) {
      throw new ForbiddenException({
        message: 'You can only delete assets within your own museum.',
        errorCode: ErrorCode.FORBIDDEN,
      });
    }

    await this.storage.deleteObject(key);
    return { message: 'Asset deleted.' };
  }

  // ── Build deterministic S3 key from context ────────────────────────────────

  private buildS3Key(dto: PresignDto, actor: JwtPayload): string {
    const ext = this.extFromMime(dto.mimeType);
    const uniquePart = uuidv4();

    switch (dto.context) {
      case 'avatar':
        return `users/${actor.sub}/avatar/${uniquePart}${ext}`;
      case 'artifact_image':
        return `museums/${dto.museumId}/artifacts/${dto.artifactId}/${uniquePart}${ext}`;
      case 'audio_guide':
        return `museums/${dto.museumId}/artifacts/${dto.artifactId}/audio/${uniquePart}${ext}`;
      case 'reward_asset':
        return `museums/${dto.museumId}/rewards/${uniquePart}${ext}`;
    }
  }

  private extFromMime(mime: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'audio/mpeg': '.mp3',
      'audio/aac': '.aac',
      'audio/ogg': '.ogg',
    };
    return map[mime] ?? path.extname(mime) ?? '';
  }
}
