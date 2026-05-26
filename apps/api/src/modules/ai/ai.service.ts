import Anthropic from '@anthropic-ai/sdk';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiFlagStatus } from '@prisma/client';
import type Redis from 'ioredis';
import OpenAI from 'openai';

import type { Socket } from 'socket.io';

import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { ErrorCode } from '../../common/errors/error-codes';
import { ApiException } from '../../common/exceptions/api.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import type { MuseumSettings } from '../game/types/game.types';

import { AnalyticsService } from '../analytics/analytics.service';

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
    private readonly analyticsService: AnalyticsService,
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

    this.analyticsService.emit('ai_session_started', dto.museumId, user.sub, {
      sessionId: session.id,
      artifactContextId: dto.artifactContextId,
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

  // ── S7-07: Suggested questions — lazy, Redis-cached 24h ──────────────────

  async getSuggestedQuestions(artifactId: string, lang: string = 'en'): Promise<string[]> {
    const cacheKey = `suggested_q:${artifactId}:${lang}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as string[];

    const artifact = await this.prisma.artifact.findFirst({
      where: { id: artifactId, deletedAt: null },
      select: { name: true, description: true, historicalContext: true, suggestedQuestions: true },
    });
    if (!artifact) return [];

    // Admin-defined questions take priority over LLM-generated ones
    const adminDefined = artifact.suggestedQuestions as string[];
    if (Array.isArray(adminDefined) && adminDefined.length > 0) {
      await this.redis.set(cacheKey, JSON.stringify(adminDefined), 'EX', 86_400);
      return adminDefined;
    }

    try {
      const langLabel = lang === 'tr' ? 'Turkish' : 'English';
      const res = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: `Generate 3-5 engaging visitor questions about this artifact in ${langLabel}.
Artifact: ${artifact.name}
Description: ${artifact.description ?? ''}
Context: ${artifact.historicalContext ?? ''}
Return ONLY a JSON array of strings, e.g. ["Question?", "Question?"]`,
          },
        ],
      });

      const text = res.content[0]?.type === 'text' ? res.content[0].text : '[]';
      const questions = JSON.parse(text) as string[];
      await this.redis.set(cacheKey, JSON.stringify(questions), 'EX', 86_400);
      return questions;
    } catch (err) {
      this.logger.warn('Failed to generate suggested questions', { artifactId, err });
      return [];
    }
  }

  // ── S7-06: Keyword blocklist + LLM moderation pre-check ──────────────────

  private async checkContentSafety(message: string, client: Socket): Promise<boolean> {
    const keywords = await this.redis.smembers('content_safety:blocklist');
    const lower = message.toLowerCase();
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        client.emit('ai:error', {
          errorCode: ErrorCode.AI_CONTENT_BLOCKED,
          message: 'Your message was blocked due to content policy.',
        });
        return false;
      }
    }

    try {
      const mod = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 10,
        system: 'You are a content safety classifier. Reply with only "SAFE" or "UNSAFE".',
        messages: [{ role: 'user', content: `Is this safe for a museum chatbot? "${message}"` }],
      });
      const verdict =
        mod.content[0]?.type === 'text' ? mod.content[0].text.trim().toUpperCase() : 'SAFE';
      if (verdict === 'UNSAFE') {
        client.emit('ai:error', {
          errorCode: ErrorCode.AI_CONTENT_BLOCKED,
          message: 'Your message was blocked due to content policy.',
        });
        return false;
      }
    } catch (err) {
      // Fail-open: a moderation timeout should not block legitimate visitors
      this.logger.warn('Content safety LLM check failed — allowing', { err });
    }

    return true;
  }

  // ── S7-04: Redis sliding window rate limiter ──────────────────────────────

  private async checkRateLimit(userId: string, limitPerMinute: number): Promise<boolean> {
    const windowKey = `ai_rate:${userId}:${Math.floor(Date.now() / 60_000)}`;
    const count = await this.redis.incr(windowKey);
    if (count === 1) {
      await this.redis.expire(windowKey, 120); // 2-min TTL for the sliding window
    }
    return count > limitPerMinute;
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

  // ── S7-03: Core streaming method invoked by the WebSocket gateway ─────────

  async streamMessage(
    client: Socket,
    user: JwtPayload,
    sessionId: string,
    userMessage: string,
  ): Promise<void> {
    const session = await this.prisma.aiChatSession.findFirst({
      where: { id: sessionId, userId: user.sub },
      include: { museum: { select: { settings: true, name: true } } },
    });

    if (!session) {
      client.emit('ai:error', { errorCode: ErrorCode.AI_SESSION_NOT_FOUND, message: 'Session not found.' });
      return;
    }

    const settings = session.museum.settings as unknown as MuseumSettings;

    // S7-08: AI enabled check (also enforced on createSession, duplicated here for WS path)
    if (!settings.ai_config?.isEnabled) {
      client.emit('ai:error', { errorCode: ErrorCode.AI_DISABLED, message: 'AI assistant is disabled for this museum.' });
      return;
    }

    // ── S7-04: Rate limit — Redis sliding window (per user, per minute) ───────
    const rateLimitHit = await this.checkRateLimit(
      user.sub,
      settings.limits.aiRateLimitPerMinute ?? 3,
    );
    if (rateLimitHit) {
      client.emit('ai:error', {
        errorCode: ErrorCode.AI_RATE_LIMIT_EXCEEDED,
        message: 'Rate limit exceeded. Please wait before sending another message.',
      });
      return;
    }

    // ── S7-05: Max conversation turns ────────────────────────────────────────
    const turnCount = await this.prisma.aiMessage.count({ where: { sessionId } });
    const maxTurns = (settings.limits.maxAiTurnsPerSession ?? 10) * 2; // user + assistant per turn
    if (turnCount >= maxTurns) {
      client.emit('ai:error', {
        errorCode: ErrorCode.AI_MAX_TURNS_EXCEEDED,
        message: 'Maximum conversation turns reached for this session.',
      });
      return;
    }

    // ── S7-06: Content safety — blocklist then LLM moderation ────────────────
    const isTerminated = await this.redis.get(`ai_session_terminated:${sessionId}`);
    if (isTerminated) {
      client.emit('ai:error', {
        errorCode: ErrorCode.AI_CONTENT_BLOCKED,
        message: 'Session has been terminated due to a content policy violation.',
      });
      return;
    }

    const safeContent = await this.checkContentSafety(userMessage, client);
    if (!safeContent) {
      await this.redis.set(`ai_session_terminated:${sessionId}`, '1', 'EX', 86_400);
      client.disconnect();
      return;
    }

    // ── RAG pipeline (S7-02) ─────────────────────────────────────────────────
    const queryVector = await this.embedText(userMessage);
    const context = await this.retrieveContext(
      session.museumId,
      queryVector,
      session.artifactContextId ?? undefined,
    );

    // Focused artifact context injection
    let focusedArtifactSection = '';
    if (session.artifactContextId) {
      const artifact = await this.prisma.artifact.findFirst({
        where: { id: session.artifactContextId, deletedAt: null },
        select: { name: true, description: true, historicalContext: true },
      });
      if (artifact) {
        focusedArtifactSection = `\n\nThe visitor is currently viewing: **${artifact.name}**\n${artifact.description ?? ''}\n${artifact.historicalContext ?? ''}`;
      }
    }

    // Build system prompt
    const personaName = settings.ai_config?.personaName ?? 'Museum Guide';
    const systemOverride = settings.ai_config?.systemPromptOverride;
    const ragContext = context
      .map((a) => `**${a.name}**: ${a.description ?? ''} ${a.historicalContext ?? ''}`)
      .join('\n---\n');

    const systemPrompt = systemOverride
      ? systemOverride
      : `You are ${personaName}, a knowledgeable and engaging guide for ${session.museum.name}.
Answer questions about artifacts and the museum concisely and informatively. Stay on topic.

Relevant artifact information:
---
${ragContext || 'No specific context available.'}
---${focusedArtifactSection}

Respond in the same language the visitor uses. Keep responses under 300 words unless more detail is needed.`;

    // Build message history (last 20 messages)
    const history = await this.prisma.aiMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { role: true, content: true },
    });

    const messages: Anthropic.MessageParam[] = [
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: userMessage },
    ];

    // Persist user message before streaming starts
    await this.prisma.aiMessage.create({
      data: { sessionId, role: 'user', content: userMessage, tokensUsed: 0 },
    });

    // ── Claude streaming (S7-03) ──────────────────────────────────────────────
    client.emit('ai:typing_start');

    let fullResponse = '';
    let outputTokens = 0;

    try {
      const stream = this.anthropic.messages.stream({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          fullResponse += event.delta.text;
          client.emit('ai:token', { token: event.delta.text });
        }
      }

      const finalMsg = await stream.finalMessage();
      outputTokens = finalMsg.usage.output_tokens;

      await this.prisma.aiMessage.create({
        data: { sessionId, role: 'assistant', content: fullResponse, tokensUsed: outputTokens },
      });

      client.emit('ai:typing_end', { content: fullResponse });
      this.logger.log(`AI stream complete: session=${sessionId} tokens=${outputTokens}`);

      // S-14: include artifactId so heatmap can weight AI interactions per artifact
      this.analyticsService.emit('ai_message_sent', session.museumId, user.sub, {
        sessionId,
        artifactId: session.artifactContextId ?? undefined,
      });
      this.analyticsService.emit('ai_response_received', session.museumId, user.sub, {
        sessionId,
        tokensUsed: outputTokens,
      });
    } catch (err) {
      this.logger.error('Claude streaming error', { sessionId, err });
      client.emit('ai:error', { errorCode: ErrorCode.INTERNAL_ERROR, message: 'AI service error. Please retry.' });
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
