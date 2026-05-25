import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ContentStatus, Difficulty } from '@prisma/client';
import type Redis from 'ioredis';

import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { ErrorCode } from '../../common/errors/error-codes';
import { ApiException } from '../../common/exceptions/api.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import type { MuseumSettings } from '../game/types/game.types';

import type { CreateQuizSessionDto } from './dto/create-quiz-session.dto';
import type { CreateQuizSessionResponseDto } from './dto/quiz-session-response.dto';
import type { CompleteQuizSessionResponseDto } from './dto/complete-quiz-session-response.dto';
import type { CreateQuizQuestionDto } from './dto/create-quiz-question.dto';
import type { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import type { LeaderboardResponseDto } from './dto/leaderboard-response.dto';
import type { ListQuizQuestionsDto } from './dto/list-quiz-questions.dto';
import type { SubmitQuizAnswerDto } from './dto/submit-quiz-answer.dto';
import type { SubmitQuizAnswerResponseDto } from './dto/submit-quiz-answer-response.dto';
import type { UpdateQuizQuestionDto } from './dto/update-quiz-question.dto';
import type { QuizClientQuestion, QuizOption, QuizQuestionRaw, QuizSessionCache } from './types/quiz.types';

@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ── Session Creation (S6-01) ──────────────────────────────────────────────

  async createSession(
    dto: CreateQuizSessionDto,
    user: JwtPayload,
  ): Promise<CreateQuizSessionResponseDto> {
    const museum = await this.prisma.museum.findFirst({
      where: { id: dto.museumId, isActive: true },
      select: { id: true, settings: true },
    });
    if (!museum) {
      throw new ApiException(
        'Museum not found or inactive.',
        ErrorCode.MUSEUM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    const settings = museum.settings as unknown as MuseumSettings;
    const limits = settings.limits;

    if (!settings?.modules?.quizEnabled) {
      throw new ApiException(
        'Quiz module is not enabled for this museum.',
        ErrorCode.QUIZ_MODULE_DISABLED,
        HttpStatus.FORBIDDEN,
      );
    }

    const questionCount = limits.questionsPerQuizByDifficulty?.[dto.difficulty] ?? 10;
    const timerSeconds = limits.quizTimerSeconds ?? 30;

    const allQuestions = await this.prisma.quizQuestion.findMany({
      where: {
        museumId: dto.museumId,
        difficulty: dto.difficulty as Difficulty,
        status: ContentStatus.published,
        deletedAt: null,
      },
      select: { id: true, questionText: true, options: true, explanation: true, difficulty: true },
    });

    if (allQuestions.length === 0) {
      throw new ApiException(
        'No published questions available for this difficulty.',
        ErrorCode.QUIZ_NO_QUESTIONS,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // Fisher-Yates shuffle, then take N
    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(questionCount, shuffled.length));
    const questionIds = selected.map((q) => q.id);

    const session = await this.prisma.quizSession.create({
      data: {
        userId: user.sub,
        museumId: dto.museumId,
        difficulty: dto.difficulty as Difficulty,
      },
    });

    const cache: QuizSessionCache = {
      userId: user.sub,
      museumId: dto.museumId,
      difficulty: dto.difficulty,
      questionIds,
      currentQuestionIndex: 0,
      timerMs: timerSeconds * 1000,
    };
    await this.redis.set(
      `quiz_session:${session.id}`,
      JSON.stringify(cache),
      'EX',
      4 * 60 * 60,
    );

    this.logger.log(`Quiz session created: ${session.id} (user=${user.sub}, museum=${dto.museumId})`);

    return {
      sessionId: session.id,
      difficulty: dto.difficulty,
      totalQuestions: selected.length,
      currentQuestion: this.toClientQuestion(
        selected[0] as QuizQuestionRaw,
        1,
        selected.length,
        timerSeconds,
      ),
    };
  }

  // ── Answer Submission (S6-02) ─────────────────────────────────────────────

  async submitAnswer(
    sessionId: string,
    dto: SubmitQuizAnswerDto,
    user: JwtPayload,
  ): Promise<SubmitQuizAnswerResponseDto> {
    // Load session from DB (source of truth for score + completion)
    const session = await this.prisma.quizSession.findFirst({
      where: { id: sessionId, userId: user.sub },
      include: { museum: { select: { settings: true } } },
    });
    if (!session) {
      throw new ApiException(
        'Quiz session not found.',
        ErrorCode.QUIZ_SESSION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }
    if (session.completedAt) {
      throw new ApiException(
        'Quiz session is already completed.',
        ErrorCode.QUIZ_SESSION_COMPLETED,
        HttpStatus.CONFLICT,
      );
    }

    // Load Redis cache for question order
    const cache = await this.getSessionCache(sessionId);

    const { questionIds, currentQuestionIndex, timerMs } = cache;
    const expectedQuestionId = questionIds[currentQuestionIndex];

    if (!expectedQuestionId || dto.questionId !== expectedQuestionId) {
      throw new ApiException(
        'This question is not the current question in your session.',
        ErrorCode.QUIZ_INVALID_QUESTION,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Load question from DB
    const question = await this.prisma.quizQuestion.findFirst({
      where: { id: dto.questionId, deletedAt: null },
      select: { id: true, questionText: true, options: true, explanation: true, difficulty: true },
    });
    if (!question) {
      throw new ApiException(
        'Question not found.',
        ErrorCode.QUIZ_INVALID_QUESTION,
        HttpStatus.NOT_FOUND,
      );
    }

    const options = question.options as unknown as QuizOption[];
    const settings = session.museum.settings as unknown as MuseumSettings;
    const limits = settings.limits;
    const timerSeconds = limits.quizTimerSeconds ?? 30;

    // Server-side timer enforcement: treat over-time submissions as incorrect
    const effectiveTimeSpentMs = dto.timeSpentMs > timerMs ? timerMs + 1 : dto.timeSpentMs;
    const timedOut = dto.timeSpentMs > timerMs || dto.selectedOptionIndex === -1;

    const correctIndex = options.findIndex((o) => o.isCorrect);
    const isCorrect =
      !timedOut && dto.selectedOptionIndex >= 0 && options[dto.selectedOptionIndex]?.isCorrect === true;

    const basePoints = isCorrect
      ? (limits.pointsPerCorrectByDifficulty?.[session.difficulty] ?? 10)
      : 0;

    const rawTimeBonus =
      isCorrect && limits.timeBonusEnabled
        ? Math.floor((limits.timeBonusMax ?? 10) * (1 - effectiveTimeSpentMs / timerMs))
        : 0;
    const timeBonus = Math.max(0, rawTimeBonus);
    const pointsEarned = basePoints + timeBonus;

    // Persist answer
    await this.prisma.quizAnswer.create({
      data: {
        sessionId,
        questionId: dto.questionId,
        selectedOption: dto.selectedOptionIndex,
        isCorrect,
        pointsEarned,
        timeSpentMs: dto.timeSpentMs,
      },
    });

    // Update session totals
    const updatedSession = await this.prisma.quizSession.update({
      where: { id: sessionId },
      data: {
        totalScore: { increment: pointsEarned },
        questionsAnswered: { increment: 1 },
        correctCount: { increment: isCorrect ? 1 : 0 },
      },
    });

    // Advance Redis cache to next question
    const nextIndex = currentQuestionIndex + 1;
    const updatedCache: QuizSessionCache = { ...cache, currentQuestionIndex: nextIndex };
    await this.redis.set(
      `quiz_session:${sessionId}`,
      JSON.stringify(updatedCache),
      'EX',
      4 * 60 * 60,
    );

    // Build next question if available
    let nextQuestion: QuizClientQuestion | null = null;
    const nextQuestionId = questionIds[nextIndex];
    if (nextIndex < questionIds.length && nextQuestionId) {
      const nextQ = await this.prisma.quizQuestion.findFirst({
        where: { id: nextQuestionId, deletedAt: null },
        select: { id: true, questionText: true, options: true, explanation: true, difficulty: true },
      });
      if (nextQ) {
        nextQuestion = this.toClientQuestion(
          nextQ as QuizQuestionRaw,
          nextIndex + 1,
          questionIds.length,
          timerSeconds,
        );
      }
    }

    return {
      isCorrect,
      correctOptionIndex: correctIndex,
      explanation: question.explanation,
      pointsEarned,
      totalScore: updatedSession.totalScore,
      nextQuestion,
    };
  }

  // ── Session Completion (S6-03) ────────────────────────────────────────────

  async completeSession(
    sessionId: string,
    user: JwtPayload,
  ): Promise<CompleteQuizSessionResponseDto> {
    const session = await this.prisma.quizSession.findFirst({
      where: { id: sessionId, userId: user.sub },
    });
    if (!session) {
      throw new ApiException(
        'Quiz session not found.',
        ErrorCode.QUIZ_SESSION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }
    if (session.completedAt) {
      throw new ApiException(
        'Quiz session is already completed.',
        ErrorCode.QUIZ_SESSION_COMPLETED,
        HttpStatus.CONFLICT,
      );
    }

    const now = new Date();

    // Mark session completed in PostgreSQL
    const completed = await this.prisma.quizSession.update({
      where: { id: sessionId },
      data: { completedAt: now },
    });

    // Upsert museum_quiz_scores — personal best logic
    const existing = await this.prisma.museumQuizScore.findFirst({
      where: { userId: user.sub, museumId: session.museumId },
    });

    let isNewPersonalBest = false;
    if (!existing) {
      await this.prisma.museumQuizScore.create({
        data: {
          userId: user.sub,
          museumId: session.museumId,
          bestScore: completed.totalScore,
          quizCount: 1,
          lastPlayedAt: now,
        },
      });
      isNewPersonalBest = true;
    } else {
      isNewPersonalBest = completed.totalScore > existing.bestScore;
      await this.prisma.museumQuizScore.update({
        where: { id: existing.id },
        data: {
          bestScore: isNewPersonalBest ? completed.totalScore : existing.bestScore,
          quizCount: { increment: 1 },
          lastPlayedAt: now,
        },
      });
    }

    // Update Redis sorted set for leaderboard (S6-04)
    const leaderboardKey = `leaderboard:${session.museumId}`;
    const scoreToStore = isNewPersonalBest ? completed.totalScore : (existing?.bestScore ?? completed.totalScore);
    await this.redis.zadd(leaderboardKey, scoreToStore, user.sub);

    // Rank = number of members with score strictly higher + 1
    const rank = await this.redis.zrevrank(leaderboardKey, user.sub);
    const userRank = rank !== null ? rank + 1 : 1;

    const accuracy =
      completed.questionsAnswered > 0
        ? Math.round((completed.correctCount / completed.questionsAnswered) * 100)
        : 0;

    // Clean up Redis session cache
    await this.redis.del(`quiz_session:${sessionId}`);

    this.logger.log(
      `Quiz session completed: ${sessionId} (score=${completed.totalScore}, rank=${userRank})`,
    );

    return {
      totalScore: completed.totalScore,
      rank: userRank,
      accuracy,
      isNewPersonalBest,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  toClientQuestion(
    question: QuizQuestionRaw,
    questionNumber: number,
    total: number,
    timerSeconds: number,
  ): QuizClientQuestion {
    const options = (question.options as QuizOption[]).map((o) => ({ text: o.text }));
    return {
      id: question.id,
      questionText: question.questionText,
      options,
      timerSeconds,
      questionNumber,
      totalQuestions: total,
    };
  }

  // ── Leaderboard (S6-04) ───────────────────────────────────────────────────

  async getLeaderboard(
    museumId: string,
    query: LeaderboardQueryDto,
  ): Promise<LeaderboardResponseDto> {
    const limit = query.limit ?? 50;
    const period = query.period ?? 'all_time';

    if (period === 'all_time') {
      return this.getLeaderboardFromRedis(museumId, limit);
    }
    // weekly / monthly — served from museum_quiz_scores as a fallback
    // (TimescaleDB continuous aggregates are wired in S6-05; for now fall back to all_time from DB)
    return this.getLeaderboardFromDb(museumId, limit, period);
  }

  private async getLeaderboardFromRedis(
    museumId: string,
    limit: number,
  ): Promise<LeaderboardResponseDto> {
    const leaderboardKey = `leaderboard:${museumId}`;
    // ZREVRANGEBYSCORE with scores
    const rawEntries = await this.redis.zrevrangebyscore(
      leaderboardKey,
      '+inf',
      '-inf',
      'WITHSCORES',
      'LIMIT',
      0,
      limit,
    );

    // rawEntries alternates: [userId, score, userId, score, ...]
    const pairs: Array<{ userId: string; score: number }> = [];
    for (let i = 0; i < rawEntries.length; i += 2) {
      pairs.push({ userId: rawEntries[i] as string, score: Number(rawEntries[i + 1]) });
    }

    if (pairs.length === 0) {
      return { museumId, period: 'all_time', entries: [] };
    }

    const userIds = pairs.map((p) => p.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true, avatarUrl: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const entries = pairs.map((p, idx) => {
      const u = userMap.get(p.userId);
      return {
        rank: idx + 1,
        userId: p.userId,
        displayName: u?.displayName ?? 'Unknown',
        avatarUrl: u?.avatarUrl ?? null,
        score: p.score,
      };
    });

    return { museumId, period: 'all_time', entries };
  }

  private async getLeaderboardFromDb(
    museumId: string,
    limit: number,
    period: string,
  ): Promise<LeaderboardResponseDto> {
    const view =
      period === 'weekly' ? 'quiz_leaderboard_weekly' : 'quiz_leaderboard_monthly';
    const windowInterval = period === 'weekly' ? '7 days' : '30 days';

    type AggRow = { user_id: string; best_score: bigint | number; display_name: string; avatar_url: string | null };

    const rows = await this.prisma.$queryRawUnsafe<AggRow[]>(
      `SELECT
         agg.user_id,
         agg.best_score,
         u.display_name,
         u.avatar_url
       FROM ${view} agg
       JOIN users u ON u.id = agg.user_id
       WHERE agg.museum_id = $1::uuid
         AND agg.bucket >= NOW() - INTERVAL '${windowInterval}'
       ORDER BY agg.best_score DESC
       LIMIT $2`,
      museumId,
      limit,
    );

    const entries = rows.map((row, idx) => ({
      rank: idx + 1,
      userId: row.user_id,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      score: Number(row.best_score),
    }));

    return { museumId, period, entries };
  }

  // ── Question Bank CRUD (S6-06) ────────────────────────────────────────────

  async createQuestion(dto: CreateQuizQuestionDto, user: JwtPayload) {
    // content_editor is scoped to own museum; super_admin can write to any
    if (user.role === 'content_editor' && user.museumId !== dto.museumId) {
      throw new ApiException('Forbidden: wrong museum.', ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }

    return this.prisma.quizQuestion.create({
      data: {
        museumId: dto.museumId,
        artifactId: dto.artifactId ?? null,
        questionText: dto.questionText,
        options: dto.options as unknown as object[],
        difficulty: dto.difficulty,
        explanation: dto.explanation ?? null,
        // Defaults to draft — only museum_admin+ can publish
        status: 'draft',
      },
    });
  }

  async listQuestions(query: ListQuizQuestionsDto, user: JwtPayload) {
    const museumId = query.museumId ?? user.museumId ?? undefined;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where = {
      ...(museumId ? { museumId } : {}),
      ...(query.difficulty ? { difficulty: query.difficulty } : {}),
      ...(query.status ? { status: query.status } : {}),
      deletedAt: null,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.quizQuestion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.quizQuestion.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async updateQuestion(id: string, dto: UpdateQuizQuestionDto, user: JwtPayload) {
    const question = await this.prisma.quizQuestion.findFirst({
      where: { id, deletedAt: null },
    });
    if (!question) {
      throw new ApiException('Question not found.', ErrorCode.QUIZ_INVALID_QUESTION, HttpStatus.NOT_FOUND);
    }

    // content_editor cannot change status to published
    if (
      dto.status === 'published' &&
      user.role !== 'museum_admin' &&
      user.role !== 'super_admin'
    ) {
      throw new ApiException(
        'Only museum_admin or super_admin can publish questions.',
        ErrorCode.FORBIDDEN,
        HttpStatus.FORBIDDEN,
      );
    }

    return this.prisma.quizQuestion.update({
      where: { id },
      data: {
        ...(dto.questionText !== undefined ? { questionText: dto.questionText } : {}),
        ...(dto.options !== undefined ? { options: dto.options as unknown as object[] } : {}),
        ...(dto.difficulty !== undefined ? { difficulty: dto.difficulty } : {}),
        ...(dto.explanation !== undefined ? { explanation: dto.explanation } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
  }

  async deleteQuestion(id: string, user: JwtPayload) {
    const question = await this.prisma.quizQuestion.findFirst({
      where: { id, deletedAt: null },
    });
    if (!question) {
      throw new ApiException('Question not found.', ErrorCode.QUIZ_INVALID_QUESTION, HttpStatus.NOT_FOUND);
    }
    if (user.role === 'content_editor' && user.museumId !== question.museumId) {
      throw new ApiException('Forbidden: wrong museum.', ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    await this.prisma.quizQuestion.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }

  async getSessionCache(sessionId: string): Promise<QuizSessionCache> {
    const raw = await this.redis.get(`quiz_session:${sessionId}`);
    if (!raw) {
      throw new ApiException(
        'Quiz session not found or expired.',
        ErrorCode.QUIZ_SESSION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }
    return JSON.parse(raw) as QuizSessionCache;
  }
}
