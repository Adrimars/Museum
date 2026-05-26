import { ApiProperty } from '@nestjs/swagger';

import { QuizClientQuestionDto } from './quiz-session-response.dto';

export class SubmitQuizAnswerResponseDto {
  @ApiProperty()
  isCorrect: boolean;

  @ApiProperty()
  correctOptionIndex: number;

  @ApiProperty({ nullable: true })
  explanation: string | null;

  @ApiProperty()
  pointsEarned: number;

  @ApiProperty()
  totalScore: number;

  @ApiProperty({ type: QuizClientQuestionDto, nullable: true, description: 'Next question, or null if quiz is done' })
  nextQuestion: QuizClientQuestionDto | null;
}
