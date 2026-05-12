import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { Prisma } from '@prisma/client';

import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { QrService } from '../qr/qr.service';
import type { CreateArtifactDto } from './dto/create-artifact.dto';
import { EmbeddingService, ARTIFACT_EMBEDDING_QUEUE, type ArtifactEmbeddingJob } from './embedding.service';
import type { ListArtifactsDto } from './dto/list-artifacts.dto';
import type { UpdateArtifactDto } from './dto/update-artifact.dto';

// Fields whose changes must re-trigger the embedding pipeline (Sprint 4).
const EMBEDDING_FIELDS = ['name', 'description', 'historicalContext'] as const;

@Injectable()
export class ArtifactsService {
  private readonly logger = new Logger(ArtifactsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly qrService: QrService,
    private readonly embeddingService: EmbeddingService,
    @InjectQueue(ARTIFACT_EMBEDDING_QUEUE) private readonly embeddingQueue: Queue<ArtifactEmbeddingJob>,
  ) {}

  // ── Paginated list with optional pg_trgm search (PRD §8.3.1) ──────────────

  async findAll(museumId: string, dto: ListArtifactsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    // When search is provided, use raw SQL for pg_trgm similarity (GIN index).
    if (dto.search) {
      return this.findAllWithSearch(museumId, dto.search, dto.period, skip, limit);
    }

    const where: Prisma.ArtifactWhereInput = {
      museumId,
      deletedAt: null,
      ...(dto.period ? { period: { contains: dto.period, mode: 'insensitive' } } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.artifact.count({ where }),
      this.prisma.artifact.findMany({
        where,
        select: {
          id: true,
          museumId: true,
          name: true,
          description: true,
          period: true,
          locationHint: true,
          mediaUrls: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { data: items, total, page, limit };
  }

  private async findAllWithSearch(
    museumId: string,
    search: string,
    period: string | undefined,
    skip: number,
    limit: number,
  ) {
    // pg_trgm `%` operator — requires GIN index created in S3-02 migration.
    type SearchRow = {
      id: string;
      museum_id: string;
      name: string;
      description: string | null;
      period: string | null;
      location_hint: string | null;
      media_urls: unknown;
      created_at: Date;
    };

    const periodClause = period ? Prisma.sql`AND period ILIKE ${`%${period}%`}` : Prisma.empty;

    const rows = await this.prisma.$queryRaw<SearchRow[]>`
      SELECT id, museum_id, name, description, period, location_hint, media_urls, created_at
      FROM artifacts
      WHERE museum_id = ${museumId}::uuid
        AND deleted_at IS NULL
        AND (name % ${search} OR description % ${search})
        ${periodClause}
      ORDER BY similarity(name, ${search}) DESC, created_at DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    const countRows = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM artifacts
      WHERE museum_id = ${museumId}::uuid
        AND deleted_at IS NULL
        AND (name % ${search} OR description % ${search})
        ${periodClause}
    `;

    return {
      data: rows.map((r) => ({
        id: r.id,
        museumId: r.museum_id,
        name: r.name,
        description: r.description,
        period: r.period,
        locationHint: r.location_hint,
        mediaUrls: r.media_urls,
        createdAt: r.created_at,
      })),
      total: Number(countRows[0]?.count ?? 0),
      page: Math.floor(skip / limit) + 1,
      limit,
    };
  }

  // ── Full artifact detail (public) ──────────────────────────────────────────

  async findOne(id: string) {
    const artifact = await this.prisma.artifact.findFirst({
      where: { id, deletedAt: null },
      include: { qrCode: { select: { id: true, imageUrl: true, scanCount: true, isActive: true } } },
    });

    if (!artifact) {
      throw new NotFoundException({
        message: 'Artifact not found.',
        errorCode: ErrorCode.ARTIFACT_NOT_FOUND,
      });
    }

    return artifact;
  }

  // ── Create (content_editor+ of the target museum) ──────────────────────────

  async create(dto: CreateArtifactDto, actor: JwtPayload, ipAddress: string) {
    this.enforceMuseumAccess(actor, dto.museumId);

    const museum = await this.prisma.museum.findUnique({ where: { id: dto.museumId } });
    if (!museum) {
      throw new NotFoundException({
        message: 'Museum not found.',
        errorCode: ErrorCode.MUSEUM_NOT_FOUND,
      });
    }

    const artifact = await this.prisma.artifact.create({
      data: {
        museumId: dto.museumId,
        name: dto.name,
        description: dto.description ?? null,
        historicalContext: dto.historicalContext ?? null,
        period: dto.period ?? null,
        locationHint: dto.locationHint ?? null,
        audioGuideUrl: dto.audioGuideUrl ?? null,
        audioTranscript: dto.audioTranscript ?? null,
      },
    });

    await this.writeAuditLog(actor, 'artifact.created', 'artifact', artifact.id, dto.museumId, ipAddress);

    // Trigger QR code auto-generation (PRD §8.4.1). Fire-and-forget — does not block the response.
    this.qrService.generateForArtifact(artifact.museumId, artifact.id).catch((err: unknown) => {
      this.logger.error('QR generation failed after artifact create', { artifactId: artifact.id, err });
    });

    // Enqueue async embedding job (PRD §8.3.2 step 6 — never blocks the API response).
    await this.embeddingQueue.add(
      { artifactId: artifact.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 2_000 } },
    );

    return artifact;
  }

  // ── Update (content_editor+ of the target museum) ─────────────────────────

  async update(id: string, dto: UpdateArtifactDto, actor: JwtPayload, ipAddress: string) {
    const artifact = await this.findOneOrThrow(id);

    this.enforceMuseumAccess(actor, artifact.museumId);

    const embeddingFieldChanged = EMBEDDING_FIELDS.some(
      (field) => dto[field] !== undefined && dto[field] !== (artifact as Record<string, unknown>)[field],
    );

    const updated = await this.prisma.artifact.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.historicalContext !== undefined && { historicalContext: dto.historicalContext }),
        ...(dto.period !== undefined && { period: dto.period }),
        ...(dto.locationHint !== undefined && { locationHint: dto.locationHint }),
        ...(dto.audioGuideUrl !== undefined && { audioGuideUrl: dto.audioGuideUrl }),
        ...(dto.audioTranscript !== undefined && { audioTranscript: dto.audioTranscript }),
      },
    });

    await this.writeAuditLog(actor, 'artifact.updated', 'artifact', id, artifact.museumId, ipAddress);

    if (embeddingFieldChanged) {
      await this.embeddingQueue.add(
        { artifactId: updated.id },
        { attempts: 3, backoff: { type: 'exponential', delay: 2_000 } },
      );
    }

    return updated;
  }

  // ── Soft-delete (museum_admin+ of the target museum) ─────────────────────

  async remove(id: string, actor: JwtPayload, ipAddress: string) {
    const artifact = await this.findOneOrThrow(id);

    // content_editor cannot delete — enforced by @Roles on the controller, but also check here.
    if (actor.role === 'content_editor') {
      throw new ForbiddenException({
        message: 'Content editors cannot delete artifacts.',
        errorCode: ErrorCode.FORBIDDEN,
      });
    }

    this.enforceMuseumAccess(actor, artifact.museumId);

    await this.prisma.$transaction([
      this.prisma.artifact.update({ where: { id }, data: { deletedAt: new Date() } }),
      // Deactivate the associated QR code if it exists (PRD §8.3.1).
      this.prisma.qrCode.updateMany({ where: { artifactId: id }, data: { isActive: false } }),
    ]);

    await this.writeAuditLog(actor, 'artifact.deleted', 'artifact', id, artifact.museumId, ipAddress);

    return { message: 'Artifact soft-deleted and QR code deactivated.' };
  }

  // ── Get associated QR code (content_editor+ of the target museum) ─────────

  async getQrCode(artifactId: string, actor: JwtPayload) {
    const artifact = await this.findOneOrThrow(artifactId);

    this.enforceMuseumAccess(actor, artifact.museumId);

    const qr = await this.prisma.qrCode.findUnique({ where: { artifactId } });

    if (!qr) {
      throw new NotFoundException({
        message: 'QR code not found for this artifact.',
        errorCode: ErrorCode.QR_NOT_FOUND,
      });
    }

    return qr;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async findOneOrThrow(id: string) {
    const artifact = await this.prisma.artifact.findFirst({ where: { id, deletedAt: null } });

    if (!artifact) {
      throw new NotFoundException({
        message: 'Artifact not found.',
        errorCode: ErrorCode.ARTIFACT_NOT_FOUND,
      });
    }

    return artifact;
  }

  private enforceMuseumAccess(actor: JwtPayload, targetMuseumId: string) {
    if (actor.role === 'super_admin') return;

    if (actor.museumId !== targetMuseumId) {
      throw new ForbiddenException({
        message: 'You can only manage artifacts within your own museum.',
        errorCode: ErrorCode.FORBIDDEN,
      });
    }
  }

  private async writeAuditLog(
    actor: JwtPayload,
    action: string,
    targetType: string,
    targetId: string,
    museumId: string,
    ipAddress: string,
  ) {
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.sub,
        actorRole: actor.role,
        action,
        targetType,
        targetId,
        museumId,
        ipAddress,
        metadata: {},
      },
    });
  }
}
