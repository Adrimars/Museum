import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ContentStatus, GameState } from '@prisma/client';
import type Redis from 'ioredis';

import { ApiException } from '../../common/exceptions/api.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { TokenService } from '../auth/token.service';
import type { Clue, MuseumSettings } from './types/game.types';
import type { CreateSessionDto } from './dto/create-session.dto';
import type { GuestTokenResponseDto } from './dto/guest-token.dto';
import type { ScanClueDto } from './dto/scan-clue.dto';
import type { SubmitAnswerDto } from './dto/submit-answer.dto';
import type { VerifyFinalCodeDto } from './dto/verify-final-code.dto';
import type { CreateScenarioDto } from './dto/create-scenario.dto';
import type { UpdateScenarioDto } from './dto/update-scenario.dto';
import type { ListScenariosDto } from './dto/list-scenarios.dto';
import type { SessionStateDto, CurrentClueDto, ClueQuestionDto } from './dto/session-state.dto';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';

/** States that represent an in-progress (non-terminal) session. */
const ACTIVE_STATES: GameState[] = [
  GameState.IDLE,
  GameState.CLUE_ACTIVE,
  GameState.QR_SCANNED,
  GameState.ANSWER_SUBMITTED,
  GameState.CORRECT,
  GameState.INCORRECT,
  GameState.FINAL_CODE,
];

/** States where the question text + options are revealed to the visitor. */
const QUESTION_VISIBLE_STATES: GameState[] = [
  GameState.QR_SCANNED,
  GameState.ANSWER_SUBMITTED,
  GameState.CORRECT,
  GameState.INCORRECT,
];

/** Default base score per correct clue answer. */
const CLUE_BASE_SCORE = 100;

type SessionRow = {
  id: string;
  state: GameState;
  scenarioId: string;
  museumId: string;
  userId: string | null;
  guestTokenJti: string | null;
  currentClueIndex: number;
  score: number;
  attemptsOnCurrentClue: number;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  scenario: { storyIntro: string; clues: unknown; finalCode: string };
  museum: { settings: unknown };
};

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ── Guest Token ───────────────────────────────────────────────────────────

  issueGuestToken(): GuestTokenResponseDto {
    const { token, expiresAt } = this.tokenService.issueGuestToken();
    return { accessToken: token, expiresAt, tokenType: 'Bearer' };
  }

  // ── Session Creation ──────────────────────────────────────────────────────

  async createSession(
    dto: CreateSessionDto,
    userId: string | null,
    guestTokenJti: string | null,
  ): Promise<SessionStateDto> {
    const scenario = await this.prisma.gameScenario.findFirst({
      where: { id: dto.scenarioId, status: 'published', deletedAt: null },
      include: { museum: { select: { id: true, isActive: true, settings: true } } },
    });

    if (!scenario) {
      throw new ApiException(
        'Game scenario not found or not published.',
        ErrorCode.GAME_SCENARIO_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    if (!scenario.museum.isActive) {
      throw new ApiException(
        'This museum is currently inactive.',
        ErrorCode.MUSEUM_INACTIVE,
        HttpStatus.FORBIDDEN,
      );
    }

    const settings = scenario.museum.settings as unknown as MuseumSettings;
    if (!settings?.modules?.treasureHuntEnabled) {
      throw new ApiException(
        'Treasure Hunt is not enabled for this museum.',
        ErrorCode.GAME_MODULE_DISABLED,
        HttpStatus.FORBIDDEN,
      );
    }

    if (userId) {
      const existing = await this.prisma.gameSession.findFirst({
        where: { userId, museumId: scenario.museumId, state: { in: ACTIVE_STATES } },
        select: { id: true },
      });
      if (existing) {
        throw new ApiException(
          'You already have an active game session. Complete or wait for it to expire.',
          ErrorCode.GAME_SESSION_ALREADY_ACTIVE,
          HttpStatus.CONFLICT,
        );
      }
    }

    const session = await this.prisma.gameSession.create({
      data: {
        userId,
        guestTokenJti,
        scenarioId: scenario.id,
        museumId: scenario.museumId,
        state: GameState.CLUE_ACTIVE,
        currentClueIndex: 0,
        score: 0,
        attemptsOnCurrentClue: 0,
      },
    });

    this.logger.log(
      `Game session created: ${session.id} (scenario=${scenario.id}, userId=${userId ?? 'guest'})`,
    );

    const row: SessionRow = {
      ...session,
      scenario: { storyIntro: scenario.storyIntro, clues: scenario.clues, finalCode: scenario.finalCode },
      museum: { settings: scenario.museum.settings },
    };
    await this.cacheSession(row, settings);
    return this.buildSessionState(row, settings);
  }

  // ── Session Retrieval ─────────────────────────────────────────────────────

  async getSession(
    sessionId: string,
    userId: string | null,
    guestTokenJti: string | null,
  ): Promise<SessionStateDto> {
    const session = await this.loadSession(sessionId);
    this.assertOwnership(session, userId, guestTokenJti);
    return this.buildSessionState(session, session.museum.settings as unknown as MuseumSettings);
  }

  // ── QR Scan (S5-03) ───────────────────────────────────────────────────────

  async scanClue(
    sessionId: string,
    dto: ScanClueDto,
    userId: string | null,
    guestTokenJti: string | null,
  ): Promise<SessionStateDto> {
    const session = await this.loadSession(sessionId);
    this.assertOwnership(session, userId, guestTokenJti);
    this.assertNotTerminal(session);

    if (session.state !== GameState.CLUE_ACTIVE) {
      throw new ApiException(
        'QR scan is only valid when a clue is active.',
        ErrorCode.GAME_INVALID_STATE,
        HttpStatus.CONFLICT,
      );
    }

    const settings = session.museum.settings as unknown as MuseumSettings;
    const clues = session.scenario.clues as unknown as Clue[];
    const currentClue = clues[session.currentClueIndex];

    if (!currentClue) {
      throw new ApiException(
        'No active clue found for this session.',
        ErrorCode.GAME_INVALID_STATE,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const qrRecord = await this.prisma.qrCode.findUnique({
      where: { codeHash: dto.codeHash },
      select: { id: true, artifactId: true, museumId: true, isActive: true },
    });

    if (!qrRecord || qrRecord.museumId !== session.museumId) {
      // Wrong museum or non-existent QR — counts as incorrect attempt (UC-GE02)
      return this.handleWrongScan(session, settings, clues);
    }

    if (!qrRecord.isActive) {
      throw new ApiException(
        'This QR code has been deactivated.',
        ErrorCode.QR_DEACTIVATED,
        HttpStatus.GONE,
      );
    }

    // UC-GE11: correct artifact but belongs to a future/past clue in the same scenario
    const isInScenario = clues.some((c) => c.artifactId === qrRecord.artifactId);
    if (isInScenario && qrRecord.artifactId !== currentClue.artifactId) {
      throw new ApiException(
        "You found the right artifact, but it's not time for this clue yet! Check your current clue hint.",
        ErrorCode.GAME_CLUE_MISMATCH,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (qrRecord.artifactId !== currentClue.artifactId) {
      // Wrong artifact entirely — counts as incorrect attempt (UC-GE02)
      return this.handleWrongScan(session, settings, clues);
    }

    // Correct QR: transition to QR_SCANNED, reveal question
    const updated = await this.prisma.gameSession.update({
      where: { id: session.id },
      data: { state: GameState.QR_SCANNED },
    });

    const merged: SessionRow = { ...session, ...updated, scenario: session.scenario, museum: session.museum };
    await this.cacheSession(merged, settings);
    return this.buildSessionState(merged, settings);
  }

  // ── Answer Submission (S5-04 + S5-05 + S5-06) ────────────────────────────

  async submitAnswer(
    sessionId: string,
    dto: SubmitAnswerDto,
    userId: string | null,
    guestTokenJti: string | null,
  ): Promise<SessionStateDto> {
    const session = await this.loadSession(sessionId);
    this.assertOwnership(session, userId, guestTokenJti);
    this.assertNotTerminal(session);

    if (session.state !== GameState.QR_SCANNED && session.state !== GameState.INCORRECT) {
      throw new ApiException(
        'Answer submission requires the QR to be scanned first.',
        ErrorCode.GAME_INVALID_STATE,
        HttpStatus.CONFLICT,
      );
    }

    const settings = session.museum.settings as unknown as MuseumSettings;
    const clues = session.scenario.clues as unknown as Clue[];
    const currentClue = clues[session.currentClueIndex]!;
    const maxAttempts = settings?.limits?.maxAnswerAttemptsPerClue ?? 3;

    const correctIndex = currentClue.question.options.findIndex((o) => o.isCorrect);
    const isCorrect = dto.selectedOption === correctIndex;

    if (isCorrect) {
      const points = this.calculateScore(dto.timeSpentMs, settings);
      return this.advanceClue(session, clues, points, settings);
    }

    // Wrong answer
    const newAttempts = session.attemptsOnCurrentClue + 1;

    if (newAttempts >= maxAttempts) {
      // S5-06: Force-skip with 0 points
      return this.forceSkipClue(session, clues, settings);
    }

    // Stay INCORRECT — hint will be revealed once hintRevealOnAttempt threshold met
    const updated = await this.prisma.gameSession.update({
      where: { id: session.id },
      data: { state: GameState.INCORRECT, attemptsOnCurrentClue: newAttempts },
    });

    const merged: SessionRow = { ...session, ...updated, scenario: session.scenario, museum: session.museum };
    await this.cacheSession(merged, settings);
    return this.buildSessionState(merged, settings);
  }

  // ── Internal: advance or force-skip ──────────────────────────────────────

  private async advanceClue(
    session: SessionRow,
    clues: Clue[],
    earnedPoints: number,
    settings: MuseumSettings,
  ): Promise<SessionStateDto> {
    const nextIndex = session.currentClueIndex + 1;
    const isLastClue = nextIndex >= clues.length;

    const updated = await this.prisma.gameSession.update({
      where: { id: session.id },
      data: {
        state: isLastClue ? GameState.FINAL_CODE : GameState.CLUE_ACTIVE,
        currentClueIndex: isLastClue ? session.currentClueIndex : nextIndex,
        score: session.score + earnedPoints,
        attemptsOnCurrentClue: 0,
      },
    });

    this.logger.log(
      `Session ${session.id}: clue ${session.currentClueIndex} correct (+${earnedPoints}pts). ` +
        (isLastClue ? 'Entering FINAL_CODE.' : `Next clue: ${nextIndex}.`),
    );

    const merged: SessionRow = { ...session, ...updated, scenario: session.scenario, museum: session.museum };
    await this.cacheSession(merged, settings);
    return this.buildSessionState(merged, settings);
  }

  private async forceSkipClue(
    session: SessionRow,
    clues: Clue[],
    settings: MuseumSettings,
  ): Promise<SessionStateDto> {
    const nextIndex = session.currentClueIndex + 1;
    const isLastClue = nextIndex >= clues.length;

    const updated = await this.prisma.gameSession.update({
      where: { id: session.id },
      data: {
        state: isLastClue ? GameState.FINAL_CODE : GameState.CLUE_ACTIVE,
        currentClueIndex: isLastClue ? session.currentClueIndex : nextIndex,
        attemptsOnCurrentClue: 0,
      },
    });

    this.logger.log(
      `Session ${session.id}: clue ${session.currentClueIndex} force-skipped (0 pts). ` +
        (isLastClue ? 'Entering FINAL_CODE.' : `Next clue: ${nextIndex}.`),
    );

    const merged: SessionRow = { ...session, ...updated, scenario: session.scenario, museum: session.museum };
    await this.cacheSession(merged, settings);
    return this.buildSessionState(merged, settings);
  }

  private async handleWrongScan(
    session: SessionRow,
    settings: MuseumSettings,
    clues: Clue[],
  ): Promise<SessionStateDto> {
    const maxAttempts = settings?.limits?.maxAnswerAttemptsPerClue ?? 3;
    const newAttempts = session.attemptsOnCurrentClue + 1;

    if (newAttempts >= maxAttempts) {
      return this.forceSkipClue(session, clues, settings);
    }

    const updated = await this.prisma.gameSession.update({
      where: { id: session.id },
      data: { attemptsOnCurrentClue: newAttempts },
    });

    const merged: SessionRow = { ...session, ...updated, scenario: session.scenario, museum: session.museum };
    await this.cacheSession(merged, settings);

    throw new ApiException(
      'Wrong QR code scanned. This counts as an incorrect attempt.',
      ErrorCode.GAME_WRONG_ARTIFACT,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  // ── Scoring ───────────────────────────────────────────────────────────────

  private calculateScore(timeSpentMs: number, settings: MuseumSettings): number {
    const limits = settings?.limits;
    const timerMs = (limits?.gameClueTimerSeconds ?? 60) * 1000;
    const timeBonusMax = limits?.timeBonusMax ?? 10;
    const timeBonusEnabled = limits?.timeBonusEnabled ?? true;

    const clampedTime = Math.min(timeSpentMs, timerMs);
    const bonus = timeBonusEnabled
      ? Math.floor(timeBonusMax * (1 - clampedTime / timerMs))
      : 0;

    return CLUE_BASE_SCORE + bonus;
  }

  // ── Final Code Verification (S5-07) ──────────────────────────────────────

  async verifyFinalCode(
    sessionId: string,
    dto: VerifyFinalCodeDto,
    userId: string | null,
    guestTokenJti: string | null,
  ): Promise<SessionStateDto> {
    const session = await this.loadSession(sessionId);
    this.assertOwnership(session, userId, guestTokenJti);
    this.assertNotTerminal(session);

    if (session.state !== GameState.FINAL_CODE) {
      throw new ApiException(
        'Final code can only be verified after all clues are completed.',
        ErrorCode.GAME_INVALID_STATE,
        HttpStatus.CONFLICT,
      );
    }

    const settings = session.museum.settings as unknown as MuseumSettings;
    const maxFinalAttempts = settings?.limits?.maxFinalCodeAttempts ?? 5;

    // Brute-force guard tracked in DB via attemptsOnCurrentClue (reused for final code)
    if (session.attemptsOnCurrentClue >= maxFinalAttempts) {
      await this.prisma.gameSession.update({
        where: { id: session.id },
        data: { state: GameState.EXPIRED },
      });
      await this.evictSession(session.id);
      throw new ApiException(
        'Maximum final code attempts exceeded. Session expired.',
        ErrorCode.GAME_SESSION_EXPIRED,
        HttpStatus.GONE,
      );
    }

    const isMatch = dto.code.trim().toUpperCase() === session.scenario.finalCode.trim().toUpperCase();

    if (!isMatch) {
      const newAttempts = session.attemptsOnCurrentClue + 1;
      const updated = await this.prisma.gameSession.update({
        where: { id: session.id },
        data: { attemptsOnCurrentClue: newAttempts },
      });
      const merged: SessionRow = { ...session, ...updated, scenario: session.scenario, museum: session.museum };
      await this.cacheSession(merged, settings);
      throw new ApiException(
        'Incorrect final code. Please try again.',
        ErrorCode.GAME_FINAL_CODE_INVALID,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // Correct final code → COMPLETED
    const completed = await this.prisma.gameSession.update({
      where: { id: session.id },
      data: { state: GameState.COMPLETED, completedAt: new Date() },
    });

    this.logger.log(`Session ${session.id} COMPLETED. Final score: ${session.score}.`);

    const mergedCompleted: SessionRow = { ...session, ...completed, scenario: session.scenario, museum: session.museum };
    await this.evictSession(session.id);   // completed sessions don't need caching

    // Reward issuance integrated in Sprint 6 (RewardsModule).

    return this.buildSessionState(mergedCompleted, settings);
  }

  // ── Guard helpers ─────────────────────────────────────────────────────────

  assertOwnership(
    session: { userId: string | null; guestTokenJti: string | null },
    userId: string | null,
    guestTokenJti: string | null,
  ): void {
    const ownerMatches =
      (session.userId !== null && session.userId === userId) ||
      (session.guestTokenJti !== null && session.guestTokenJti === guestTokenJti);

    if (!ownerMatches) {
      throw new ApiException(
        'You do not have access to this game session.',
        ErrorCode.FORBIDDEN,
        HttpStatus.FORBIDDEN,
      );
    }
  }

  assertNotTerminal(session: { state: GameState }): void {
    if (session.state === GameState.EXPIRED) {
      throw new ApiException(
        'This game session has expired.',
        ErrorCode.GAME_SESSION_EXPIRED,
        HttpStatus.GONE,
      );
    }
    if (session.state === GameState.COMPLETED) {
      throw new ApiException(
        'This game session is already completed.',
        ErrorCode.GAME_SESSION_COMPLETED,
        HttpStatus.CONFLICT,
      );
    }
  }

  // ── Session loader (S5-08: Redis hot-path) ───────────────────────────────

  async loadSession(sessionId: string): Promise<SessionRow> {
    // 1. Try Redis cache first
    const cached = await this.getCachedSession(sessionId);
    if (cached) {
      await this.checkAndExpireTimeout(cached);
      return cached;
    }

    // 2. Cache miss → Postgres
    const session = await this.prisma.gameSession.findFirst({
      where: { id: sessionId },
      include: {
        scenario: { select: { storyIntro: true, clues: true, finalCode: true } },
        museum: { select: { settings: true } },
      },
    });

    if (!session) {
      throw new ApiException(
        'Game session not found.',
        ErrorCode.GAME_SESSION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    const row = session as unknown as SessionRow;
    const settings = row.museum.settings as unknown as MuseumSettings;

    // S5-09: expire check on load
    await this.checkAndExpireTimeout(row);

    // Re-cache for hot path
    await this.cacheSession(row, settings);

    return row;
  }

  // ── Cache helpers (S5-08) ─────────────────────────────────────────────────

  private sessionCacheKey(sessionId: string): string {
    return `game:session:${sessionId}`;
  }

  private async getCachedSession(sessionId: string): Promise<SessionRow | null> {
    try {
      const raw = await this.redis.get(this.sessionCacheKey(sessionId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SessionRow;
      // Revive Date fields
      parsed.createdAt = new Date(parsed.createdAt);
      parsed.updatedAt = new Date(parsed.updatedAt);
      if (parsed.completedAt) parsed.completedAt = new Date(parsed.completedAt);
      return parsed;
    } catch {
      return null;
    }
  }

  async cacheSession(session: SessionRow, settings: MuseumSettings): Promise<void> {
    const timeoutHours = settings?.limits?.gameSessionTimeoutHours ?? 4;
    const timeoutMs = timeoutHours * 3600 * 1000;
    const elapsedMs = Date.now() - new Date(session.createdAt).getTime();
    const remainingSec = Math.max(1, Math.ceil((timeoutMs - elapsedMs) / 1000));

    await this.redis.set(
      this.sessionCacheKey(session.id),
      JSON.stringify(session),
      'EX',
      remainingSec,
    );
  }

  async evictSession(sessionId: string): Promise<void> {
    await this.redis.del(this.sessionCacheKey(sessionId));
  }

  // ── Timeout check (S5-09) ─────────────────────────────────────────────────

  private async checkAndExpireTimeout(session: SessionRow): Promise<void> {
    if (session.state === GameState.COMPLETED || session.state === GameState.EXPIRED) return;

    const settings = session.museum.settings as unknown as MuseumSettings;
    const timeoutHours = settings?.limits?.gameSessionTimeoutHours ?? 4;
    const timeoutMs = timeoutHours * 3600 * 1000;
    const age = Date.now() - new Date(session.createdAt).getTime();

    if (age > timeoutMs) {
      await this.prisma.gameSession.update({
        where: { id: session.id },
        data: { state: GameState.EXPIRED },
      });
      await this.evictSession(session.id);
      session.state = GameState.EXPIRED;
      this.logger.log(`Session ${session.id} expired after ${Math.round(age / 3600000)}h.`);
    }
  }

  // ── Response builder ──────────────────────────────────────────────────────

  buildSessionState(session: SessionRow, settings: MuseumSettings): SessionStateDto {
    const clues = session.scenario.clues as unknown as Clue[];
    const isFirstClue = session.currentClueIndex === 0;
    const currentClue = clues[session.currentClueIndex] ?? null;
    const showQuestion = QUESTION_VISIBLE_STATES.includes(session.state);
    const hintRevealAt = settings?.limits?.hintRevealOnAttempt ?? 2;

    let clueDto: CurrentClueDto | null = null;
    if (currentClue && session.state !== GameState.COMPLETED && session.state !== GameState.EXPIRED) {
      let questionDto: ClueQuestionDto | null = null;
      if (showQuestion) {
        questionDto = {
          text: currentClue.question.text,
          options: currentClue.question.options.map((o) => o.text),
          hint:
            session.attemptsOnCurrentClue >= hintRevealAt
              ? currentClue.question.hintText
              : null,
        };
      }

      clueDto = {
        clueIndex: currentClue.clueIndex,
        narrativeText: currentClue.narrativeText,
        locationHint: currentClue.locationHint,
        question: questionDto,
      };
    }

    return {
      id: session.id,
      state: session.state,
      scenarioId: session.scenarioId,
      currentClueIndex: session.currentClueIndex,
      totalClues: clues.length,
      score: session.score,
      attemptsOnCurrentClue: session.attemptsOnCurrentClue,
      storyIntro: isFirstClue ? session.scenario.storyIntro : null,
      currentClue: clueDto,
      completedAt: session.completedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  // ── Scenario CRUD (S5-10) ─────────────────────────────────────────────────

  async listScenarios(query: ListScenariosDto, actor: JwtPayload) {
    const museumId =
      actor.role === 'super_admin'
        ? query.museumId
        : actor.museumId ?? undefined;

    const isAdmin = ['museum_admin', 'content_editor', 'super_admin'].includes(actor.role);

    return this.prisma.gameScenario.findMany({
      where: {
        ...(museumId ? { museumId } : {}),
        ...(!isAdmin ? { status: ContentStatus.published } : {}),
        deletedAt: null,
      },
      select: {
        id: true,
        museumId: true,
        title: true,
        difficulty: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        // clues intentionally excluded from list view (large payload)
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getScenario(id: string, actor: JwtPayload) {
    const scenario = await this.prisma.gameScenario.findFirst({
      where: { id, deletedAt: null },
    });

    if (!scenario) {
      throw new ApiException(
        'Game scenario not found.',
        ErrorCode.GAME_SCENARIO_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    const isAdmin = ['museum_admin', 'content_editor', 'super_admin'].includes(actor.role);
    if (!isAdmin && scenario.status !== ContentStatus.published) {
      throw new ApiException(
        'Game scenario not found.',
        ErrorCode.GAME_SCENARIO_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    return scenario;
  }

  async createScenario(dto: CreateScenarioDto, actor: JwtPayload, ip: string) {
    const museumId = actor.role === 'super_admin' ? undefined : (actor.museumId ?? undefined);
    if (!museumId && actor.role !== 'super_admin') {
      throw new ApiException(
        'Museum context required to create a scenario.',
        ErrorCode.MUSEUM_NOT_FOUND,
        HttpStatus.BAD_REQUEST,
      );
    }

    const resolvedMuseumId = museumId!;

    const scenario = await this.prisma.gameScenario.create({
      data: {
        museumId: resolvedMuseumId,
        title: dto.title,
        storyIntro: dto.storyIntro,
        difficulty: dto.difficulty,
        clues: dto.clues as unknown as object[],
        finalCode: dto.finalCode,
        rewardId: dto.rewardId ?? null,
        status: ContentStatus.draft,
      },
    });

    await this.writeAuditLog(actor, 'game_scenario.created', 'game_scenario', scenario.id, resolvedMuseumId, ip);
    return scenario;
  }

  async updateScenario(id: string, dto: UpdateScenarioDto, actor: JwtPayload, ip: string) {
    const scenario = await this.prisma.gameScenario.findFirst({
      where: { id, deletedAt: null },
    });

    if (!scenario) {
      throw new ApiException(
        'Game scenario not found.',
        ErrorCode.GAME_SCENARIO_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    this.assertMuseumScope(actor, scenario.museumId);

    const updated = await this.prisma.gameScenario.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.storyIntro !== undefined && { storyIntro: dto.storyIntro }),
        ...(dto.difficulty !== undefined && { difficulty: dto.difficulty }),
        ...(dto.clues !== undefined && { clues: dto.clues as unknown as object[] }),
        ...(dto.finalCode !== undefined && { finalCode: dto.finalCode }),
        ...(dto.rewardId !== undefined && { rewardId: dto.rewardId }),
      },
    });

    await this.writeAuditLog(actor, 'game_scenario.updated', 'game_scenario', id, scenario.museumId, ip);
    return updated;
  }

  async publishScenario(id: string, actor: JwtPayload, ip: string) {
    const scenario = await this.prisma.gameScenario.findFirst({
      where: { id, deletedAt: null },
    });

    if (!scenario) {
      throw new ApiException(
        'Game scenario not found.',
        ErrorCode.GAME_SCENARIO_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    this.assertMuseumScope(actor, scenario.museumId);

    const updated = await this.prisma.gameScenario.update({
      where: { id },
      data: { status: ContentStatus.published },
    });

    await this.writeAuditLog(actor, 'game_scenario.published', 'game_scenario', id, scenario.museumId, ip);
    this.logger.log(`Scenario ${id} published by ${actor.sub}`);
    return updated;
  }

  async unpublishScenario(id: string, actor: JwtPayload, ip: string) {
    const scenario = await this.prisma.gameScenario.findFirst({
      where: { id, deletedAt: null },
    });

    if (!scenario) {
      throw new ApiException(
        'Game scenario not found.',
        ErrorCode.GAME_SCENARIO_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    this.assertMuseumScope(actor, scenario.museumId);

    const updated = await this.prisma.gameScenario.update({
      where: { id },
      data: { status: ContentStatus.draft },
    });

    await this.writeAuditLog(actor, 'game_scenario.unpublished', 'game_scenario', id, scenario.museumId, ip);
    return updated;
  }

  async deleteScenario(id: string, actor: JwtPayload, ip: string) {
    const scenario = await this.prisma.gameScenario.findFirst({
      where: { id, deletedAt: null },
    });

    if (!scenario) {
      throw new ApiException(
        'Game scenario not found.',
        ErrorCode.GAME_SCENARIO_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    this.assertMuseumScope(actor, scenario.museumId);

    await this.prisma.gameScenario.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.writeAuditLog(actor, 'game_scenario.deleted', 'game_scenario', id, scenario.museumId, ip);
    this.logger.log(`Scenario ${id} soft-deleted by ${actor.sub}`);
  }

  private assertMuseumScope(actor: JwtPayload, scenarioMuseumId: string): void {
    if (actor.role !== 'super_admin' && actor.museumId !== scenarioMuseumId) {
      throw new ApiException(
        'You can only manage scenarios within your own museum.',
        ErrorCode.FORBIDDEN,
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async writeAuditLog(
    actor: JwtPayload,
    action: string,
    targetType: string,
    targetId: string,
    museumId: string,
    ip: string,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.sub,
        actorRole: actor.role,
        action,
        targetType,
        targetId,
        museumId,
        ipAddress: ip,
        metadata: {},
      },
    });
  }
}
