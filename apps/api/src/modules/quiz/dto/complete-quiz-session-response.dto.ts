import { ApiProperty } from '@nestjs/swagger';

export class CompleteQuizSessionResponseDto {
  @ApiProperty()
  totalScore: number;

  @ApiProperty({ description: '1-based rank on the all-time leaderboard for this museum' })
  rank: number;

  @ApiProperty({ description: 'Percentage of questions answered correctly' })
  accuracy: number;

  @ApiProperty({ description: 'Whether this score beat the user\'s previous personal best' })
  isNewPersonalBest: boolean;
}
