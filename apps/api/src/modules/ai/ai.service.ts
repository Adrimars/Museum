import Anthropic from '@anthropic-ai/sdk';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiFlagStatus } from '@prisma/client';
import type Redis from 'ioredis';
import OpenAI from 'openai';

import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { ErrorCode } from '../../common/errors/error-codes';
import { ApiException } from '../../common/exceptions/api.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import type { MuseumSettings } from '../game/types/game.types';

import type { CreateChatSessionDto } from './dto/create-chat-session.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  readonly anthropic: Anthropic;
  readonly openai: OpenAI;
  readonly model: string;

  constructor(
    readonly prisma: PrismaService,
    readonly config: ConfigService,
    @Inject(REDIS_CLIENT) readonly redis: Redis,
  ) {
    this.anthropic = new Anthropic({
      apiKey: config.get<string>('anthropic.apiKey', ''),
    });
    this.openai = new OpenAI({ apiKey: config.get<string>('openai.apiKey', '') });
    this.model = config.get<string>('anthropic.model', 'claude-sonnet-4-6');
  }

  // ── S7-01: Chat session creation (S7-08: AI-disabled gate applied here) ──

  async createSession(dto: CreateChatSessionDto, user: JwtPayload) {
    const museum = await this.prisma.museum.findFirst({
      where: { id: dto.museumId, isActive: true },
      select: { id: true, settings: true },
    });
    if (!museum) {
      throw new ApiException('Museum not found or inactive.', ErrorCode.MUSEUM_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    this.enforceAiEnabled(museum.settings as unknown as MuseumSettings);

    const session = await this.prisma.aiChatSession.create({
      data: {
        userId: user.sub,
        museumId: dto.museumId,
        artifactContextId: dto.artifactContextId ?? null,
      },
    });

    this.logger.log(`AI chat session created: ${session.id} (user=${user.sub})`);
    return session;
  }

  // ── S7-01: Fetch session with full message history ────────────────────────

  async getSession(sessionId: string, user: JwtPayload) {
    const session = await this.prisma.aiChatSession.findFirst({
      where: { id: sessionId, userId: user.sub },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            tokensUsed: true,
            flagStatus: true,
            createdAt: true,
          },
        },
      },
    });

    if (!session) {
      throw new ApiException('Session not found.', ErrorCode.AI_SESSION_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    return session;
  }

  // ── S7-08: Museum-level AI disabled gate (also used by streamMessage) ─────

  enforceAiEnabled(settings: MuseumSettings): void {
    if (!settings.ai_config?.isEnabled) {
      throw new ApiException(
        'AI assistant is disabled for this museum.',
        ErrorCode.AI_DISABLED,
        HttpStatus.FORBIDDEN,
      );
    }
  }

  // ── S7-02: Embed a text query using OpenAI text-embedding-3-small ─────────

  async embedText(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8_000),
    });
    return response.data[0]!.embedding;
  }

  // ── S7-02: pgvector cosine similarity retrieval — top-3 artifact chunks ──

  async retrieveContext(
    museumId: string,
    queryVector: number[],
    excludeArtifactId?: string,
  ): Promise<Array<{ name: string; description: string | null; historicalContext: string | null }>> {
    type Row = { name: string; description: string | null; historical_context: string | null };
    const vectorStr = `[${queryVector.join(',')}]`;

    try {
      const rows = excludeArtifactId
        ? await this.prisma.$queryRaw<Row[]>`
            SELECT name, description, historical_context
            FROM artifacts
            WHERE museum_id = ${museumId}::uuid
              AND deleted_at IS NULL
              AND embedding IS NOT NULL
              AND id != ${excludeArtifactId}::uuid
            ORDER BY embedding <=> ${vectorStr}::vector
            LIMIT 3
          `
        : await this.prisma.$queryRaw<Row[]>`
            SELECT name, description, historical_context
            FROM artifacts
            WHERE museum_id = ${museumId}::uuid
              AND deleted_at IS NULL
              AND embedding IS NOT NULL
            ORDER BY embedding <=> ${vectorStr}::vector
            LIMIT 3
          `;

      return rows.map((r) => ({
        name: r.name,
        description: r.description,
        historicalContext: r.historical_context,
      }));
    } catch (err) {
      this.logger.warn('RAG retrieval failed — proceeding without context', { err });
      return [];
    }
  }

  // ── S7-09: Message flagging — added in the S7-09 commit ──────────────────

  async flagMessage(messageId: string, flagStatus: 'flagged' | 'dismissed', actor: JwtPayload) {
    const message = await this.prisma.aiMessage.findFirst({
      where: { id: messageId },
      include: { session: { select: { userId: true } } },
    });

    if (!message) {
      throw new ApiException('Message not found.', ErrorCode.AI_SESSION_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    if (actor.role === 'user' && message.session.userId !== actor.sub) {
      throw new ApiException('Forbidden.', ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }

    return this.prisma.aiMessage.update({
      where: { id: messageId },
      data: { flagStatus: flagStatus as AiFlagStatus },
      select: { id: true, flagStatus: true },
    });
  }
}
