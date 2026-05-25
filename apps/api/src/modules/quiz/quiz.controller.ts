import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

import { CreateQuizSessionDto } from './dto/create-quiz-session.dto';
import type { CreateQuizSessionResponseDto } from './dto/quiz-session-response.dto';
import { SubmitQuizAnswerDto } from './dto/submit-quiz-answer.dto';
import type { CompleteQuizSessionResponseDto } from './dto/complete-quiz-session-response.dto';
import { CreateQuizQuestionDto } from './dto/create-quiz-question.dto';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import type { LeaderboardResponseDto } from './dto/leaderboard-response.dto';
import { ListQuizQuestionsDto } from './dto/list-quiz-questions.dto';
import type { SubmitQuizAnswerResponseDto } from './dto/submit-quiz-answer-response.dto';
import { UpdateQuizQuestionDto } from './dto/update-quiz-question.dto';
import { QuizService } from './quiz.service';

@ApiTags('quiz')
@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  // ── Leaderboard (S6-04) ────────────────────────────────────────────────────

  @Get('leaderboard/:museumId')
  @ApiOperation({ summary: 'Get museum leaderboard; all_time from Redis, weekly/monthly from DB (S6-04)' })
  getLeaderboard(
    @Param('museumId', ParseUUIDPipe) museumId: string,
    @Query() query: LeaderboardQueryDto,
  ): Promise<LeaderboardResponseDto> {
    return this.quizService.getLeaderboard(museumId, query);
  }

  // ── Session Creation (S6-01) ───────────────────────────────────────────────

  @Post('sessions')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @Roles('user', 'content_editor', 'museum_admin', 'super_admin')
  @ApiOperation({ summary: 'Create a quiz session with randomly selected questions (S6-01)' })
  createSession(
    @Body() dto: CreateQuizSessionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CreateQuizSessionResponseDto> {
    return this.quizService.createSession(dto, user);
  }

  // ── Session Completion (S6-03) ─────────────────────────────────────────────

  @Post('sessions/:id/complete')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Roles('user', 'content_editor', 'museum_admin', 'super_admin')
  @ApiOperation({ summary: 'Finalize quiz session, upsert personal best, return rank (S6-03)' })
  completeSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CompleteQuizSessionResponseDto> {
    return this.quizService.completeSession(id, user);
  }

  // ── Question Bank CRUD (S6-06) ─────────────────────────────────────────────

  @Post('questions')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @Roles('content_editor', 'museum_admin', 'super_admin')
  @ApiOperation({ summary: 'Create a quiz question in draft status (S6-06)' })
  createQuestion(@Body() dto: CreateQuizQuestionDto, @CurrentUser() user: JwtPayload) {
    return this.quizService.createQuestion(dto, user);
  }

  @Get('questions')
  @ApiBearerAuth()
  @Roles('content_editor', 'museum_admin', 'super_admin')
  @ApiOperation({ summary: 'List quiz questions with filtering by museum/difficulty/status (S6-06)' })
  listQuestions(@Query() query: ListQuizQuestionsDto, @CurrentUser() user: JwtPayload) {
    return this.quizService.listQuestions(query, user);
  }

  @Patch('questions/:id')
  @ApiBearerAuth()
  @Roles('content_editor', 'museum_admin', 'super_admin')
  @ApiOperation({ summary: 'Update a quiz question; only museum_admin+ can publish (S6-06)' })
  updateQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuizQuestionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.quizService.updateQuestion(id, dto, user);
  }

  @Delete('questions/:id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Roles('museum_admin', 'super_admin')
  @ApiOperation({ summary: 'Soft-delete a quiz question (S6-06)' })
  deleteQuestion(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.quizService.deleteQuestion(id, user);
  }

  // ── Answer Submission (S6-02) ──────────────────────────────────────────────

  @Post('sessions/:id/answer')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Roles('user', 'content_editor', 'museum_admin', 'super_admin')
  @ApiOperation({ summary: 'Submit an answer for the current question; enforces server-side timer (S6-02)' })
  submitAnswer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitQuizAnswerDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<SubmitQuizAnswerResponseDto> {
    return this.quizService.submitAnswer(id, dto, user);
  }
}
