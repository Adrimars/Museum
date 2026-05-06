import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateMuseumDto } from './dto/create-museum.dto';
import type { ListMuseumsDto } from './dto/list-museums.dto';
import type { UpdateMuseumDto } from './dto/update-museum.dto';

// PRD §12.3.1 — factory defaults seeded on every new museum
const DEFAULT_SETTINGS = {
  theme: {
    primaryColor: '#1E40AF',
    secondaryColor: '#F59E0B',
    logoUrl: null,
  },
  ai_config: {
    personaName: 'Museum Guide',
    systemPromptOverride:
      'You are a friendly museum guide specializing in the artifacts and history of this museum.',
    isEnabled: true,
  },
  modules: {
    quizEnabled: true,
    treasureHuntEnabled: true,
    aiAssistantEnabled: true,
  },
  limits: {
    maxAnswerAttemptsPerClue: 3,
    hintsPerClue: 1,
    hintRevealOnAttempt: 2,
    gameSessionTimeoutHours: 4,
    quizTimerSeconds: 30,
    maxAiTurnsPerSession: 5,
    aiRateLimitPerMinute: 3,
    questionsPerQuizByDifficulty: { easy: 10, medium: 15, hard: 20 },
    pointsPerCorrectByDifficulty: { easy: 10, medium: 20, hard: 30 },
    gameClueTimerSeconds: 60,
    timeBonusEnabled: true,
    timeBonusMax: 10,
    maxFinalCodeAttempts: 5,
  },
};

interface CursorPayload {
  createdAt: string;
  id: string;
}

@Injectable()
export class MuseumsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── List (public, cursor-based) ─────────────────────────────────────────

  async findAll(dto: ListMuseumsDto) {
    const limit = dto.limit ?? 20;
    let cursorPayload: CursorPayload | null = null;

    if (dto.cursor) {
      try {
        cursorPayload = JSON.parse(
          Buffer.from(dto.cursor, 'base64').toString('utf8'),
        ) as CursorPayload;
      } catch {
        cursorPayload = null;
      }
    }

    const museums = await this.prisma.museum.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...(cursorPayload
          ? {
              OR: [
                { createdAt: { gt: new Date(cursorPayload.createdAt) } },
                {
                  createdAt: { equals: new Date(cursorPayload.createdAt) },
                  id: { gt: cursorPayload.id },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        address: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });

    const hasMore = museums.length > limit;
    const items = hasMore ? museums.slice(0, limit) : museums;

    const nextCursor =
      hasMore && items.length > 0
        ? Buffer.from(
            JSON.stringify({
              createdAt: items[items.length - 1]!.createdAt.toISOString(),
              id: items[items.length - 1]!.id,
            }),
          ).toString('base64')
        : null;

    return { data: items, cursor: nextCursor, hasMore };
  }

  // ── Detail (public) ─────────────────────────────────────────────────────

  async findOne(id: string) {
    const museum = await this.prisma.museum.findFirst({
      where: { id, deletedAt: null },
    });

    if (!museum) {
      throw new NotFoundException({
        message: 'Museum not found.',
        errorCode: 'MUSEUM_NOT_FOUND',
      });
    }

    return museum;
  }

  // ── Create (super_admin) ────────────────────────────────────────────────

  async create(dto: CreateMuseumDto) {
    const existing = await this.prisma.museum.findFirst({
      where: { slug: dto.slug, deletedAt: null },
    });

    if (existing) {
      throw new ConflictException({
        message: 'A museum with this slug already exists.',
        errorCode: 'MUSEUM_SLUG_EXISTS',
      });
    }

    return this.prisma.museum.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        logoUrl: dto.logoUrl,
        address: dto.address as object,
        settings: DEFAULT_SETTINGS,
        isActive: false, // museums start inactive per PRD §12.3
      },
    });
  }

  // ── Update (museum_admin own | super_admin any) ─────────────────────────

  async update(id: string, dto: UpdateMuseumDto, actor: JwtPayload) {
    const museum = await this.prisma.museum.findFirst({
      where: { id, deletedAt: null },
    });

    if (!museum) {
      throw new NotFoundException({
        message: 'Museum not found.',
        errorCode: 'MUSEUM_NOT_FOUND',
      });
    }

    if (actor.role === 'museum_admin' && actor.museumId !== id) {
      throw new ForbiddenException({
        message: 'You can only update your own museum.',
        errorCode: 'FORBIDDEN',
      });
    }

    if (dto.slug !== undefined && dto.slug !== museum.slug) {
      const slugConflict = await this.prisma.museum.findFirst({
        where: { slug: dto.slug, deletedAt: null, NOT: { id } },
      });
      if (slugConflict) {
        throw new ConflictException({
          message: 'A museum with this slug already exists.',
          errorCode: 'MUSEUM_SLUG_EXISTS',
        });
      }
    }

    // Merge incoming settings with existing rather than replace entirely
    const mergedSettings =
      dto.settings !== undefined
        ? { ...(museum.settings as object), ...dto.settings }
        : undefined;

    return this.prisma.museum.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.address !== undefined && { address: dto.address as object }),
        ...(mergedSettings !== undefined && { settings: mergedSettings }),
      },
    });
  }

  // ── Soft-delete (super_admin) ───────────────────────────────────────────

  async remove(id: string) {
    const museum = await this.prisma.museum.findFirst({
      where: { id, deletedAt: null },
    });

    if (!museum) {
      throw new NotFoundException({
        message: 'Museum not found.',
        errorCode: 'MUSEUM_NOT_FOUND',
      });
    }

    await this.prisma.museum.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Museum soft-deleted.' };
  }
}
