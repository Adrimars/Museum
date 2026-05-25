import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

import { CreateQuizSessionDto } from './dto/create-quiz-session.dto';
import type { CreateQuizSessionResponseDto } from './dto/quiz-session-response.dto';
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
}
