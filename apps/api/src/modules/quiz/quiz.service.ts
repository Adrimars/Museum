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
import type { SubmitQuizAnswerDto } from './dto/submit-quiz-answer.dto';
import type { SubmitQuizAnswerResponseDto } from './dto/submit-quiz-answer-response.dto';
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
