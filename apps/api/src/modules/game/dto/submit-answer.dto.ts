import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class SubmitAnswerDto {
  @ApiProperty({ description: 'Zero-based index of the selected answer option' })
  @IsInt()
  @Min(0)
  selectedOption: number;

  @ApiProperty({ description: 'Client-reported time spent on this clue in milliseconds' })
  @IsInt()
  @Min(0)
  timeSpentMs: number;
}
