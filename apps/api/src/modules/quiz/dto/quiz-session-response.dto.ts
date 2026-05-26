import { ApiProperty } from '@nestjs/swagger';

import type { QuizClientQuestion } from '../types/quiz.types';

export class QuizClientOptionDto {
  @ApiProperty()
  text: string;
}

export class QuizClientQuestionDto implements QuizClientQuestion {
  @ApiProperty()
  id: string;

  @ApiProperty()
  questionText: string;

  @ApiProperty({ type: [QuizClientOptionDto] })
  options: QuizClientOptionDto[];

  @ApiProperty()
  timerSeconds: number;

  @ApiProperty()
  questionNumber: number;

  @ApiProperty()
  totalQuestions: number;
}

export class CreateQuizSessionResponseDto {
  @ApiProperty()
  sessionId: string;

  @ApiProperty()
  difficulty: string;

  @ApiProperty()
  totalQuestions: number;

  @ApiProperty({ type: QuizClientQuestionDto })
  currentQuestion: QuizClientQuestionDto;
}
