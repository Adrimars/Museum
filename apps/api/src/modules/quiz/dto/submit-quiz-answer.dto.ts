import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

export class SubmitQuizAnswerDto {
  @ApiProperty({ description: 'ID of the question being answered' })
  @IsUUID()
  questionId: string;

  @ApiProperty({ description: 'Zero-based index of the chosen option. Pass -1 for timer expiry.' })
  @IsInt()
  selectedOptionIndex: number;

  @ApiProperty({ description: 'Milliseconds elapsed since question was presented' })
  @IsInt()
  @Min(0)
  timeSpentMs: number;
}
