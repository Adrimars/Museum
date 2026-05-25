import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

import { CreateQuizSessionDto } from './dto/create-quiz-session.dto';
import type { CreateQuizSessionResponseDto } from './dto/quiz-session-response.dto';
import { SubmitQuizAnswerDto } from './dto/submit-quiz-answer.dto';
import type { SubmitQuizAnswerResponseDto } from './dto/submit-quiz-answer-response.dto';
import { QuizService } from './quiz.service';

@ApiTags('quiz')
@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

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
