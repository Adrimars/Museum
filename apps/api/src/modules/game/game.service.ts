import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { GameState } from '@prisma/client';

import { ApiException } from '../../common/exceptions/api.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import type { Clue, MuseumSettings } from './types/game.types';
import type { CreateSessionDto } from './dto/create-session.dto';
import type { SessionStateDto, CurrentClueDto, ClueQuestionDto } from './dto/session-state.dto';

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

/** States in which the question is visible to the visitor. */
const QUESTION_VISIBLE_STATES: GameState[] = [
  GameState.QR_SCANNED,
  GameState.ANSWER_SUBMITTED,
  GameState.CORRECT,
  GameState.INCORRECT,
];

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Session Creation ──────────────────────────────────────────────────────

  async createSession(
    dto: CreateSessionDto,
    userId: string | null,
    guestTokenJti: string | null,
  ): Promise<SessionStateDto> {
    const scenario = await this.prisma.gameScenario.findFirst({
      where: { id: dto.scenarioId, status: 'published', deletedAt: null },
      include: {
        museum: { select: { id: true, isActive: true, settings: true } },
      },
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

    // UC-GE04: Reject if the player already has an active session in this museum
    if (userId) {
      const existing = await this.prisma.gameSession.findFirst({
        where: { userId, museumId: scenario.museumId, state: { in: ACTIVE_STATES } },
        select: { id: true },
      });
      if (existing) {
        throw new ApiException(
          'You already have an active game session. Complete or wait for it to expire before starting a new one.',
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
      `Game session created: ${session.id} for scenario ${scenario.id} (userId=${userId ?? 'guest'})`,
    );

    return this.buildSessionState(
      session,
      scenario.storyIntro,
      scenario.clues as unknown as Clue[],
      settings,
    );
  }

  // ── Session Retrieval ─────────────────────────────────────────────────────

  async getSession(
    sessionId: string,
    userId: string | null,
    guestTokenJti: string | null,
  ): Promise<SessionStateDto> {
    const session = await this.prisma.gameSession.findFirst({
      where: { id: sessionId },
      include: {
        scenario: { select: { storyIntro: true, clues: true } },
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

    this.assertOwnership(session, userId, guestTokenJti);

    const settings = session.museum.settings as unknown as MuseumSettings;

    return this.buildSessionState(
      session,
      session.scenario.storyIntro,
      session.scenario.clues as unknown as Clue[],
      settings,
    );
  }

  // ── Internal Helpers ──────────────────────────────────────────────────────

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

  buildSessionState(
    session: {
      id: string;
      state: GameState;
      scenarioId: string;
      currentClueIndex: number;
      score: number;
      attemptsOnCurrentClue: number;
      completedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    storyIntro: string,
    clues: Clue[],
    settings: MuseumSettings,
  ): SessionStateDto {
    const isFirstClueStep = session.currentClueIndex === 0;
    const currentClue = clues[session.currentClueIndex] ?? null;
    const showQuestion = QUESTION_VISIBLE_STATES.includes(session.state);
    const hintRevealThreshold = settings?.limits?.hintRevealOnAttempt ?? 2;

    let clueDto: CurrentClueDto | null = null;
    if (currentClue && session.state !== GameState.COMPLETED && session.state !== GameState.EXPIRED) {
      let questionDto: ClueQuestionDto | null = null;
      if (showQuestion) {
        const hintVisible = session.attemptsOnCurrentClue >= hintRevealThreshold;
        questionDto = {
          text: currentClue.question.text,
          options: currentClue.question.options.map((o) => o.text),
          hint: hintVisible ? currentClue.question.hintText : null,
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
      storyIntro: isFirstClueStep ? storyIntro : null,
      currentClue: clueDto,
      completedAt: session.completedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}
