import { ApiProperty } from '@nestjs/swagger';

export class LeaderboardEntryDto {
  @ApiProperty()
  rank: number;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty({ nullable: true })
  avatarUrl: string | null;

  @ApiProperty()
  score: number;
}

export class LeaderboardResponseDto {
  @ApiProperty()
  museumId: string;

  @ApiProperty()
  period: string;

  @ApiProperty({ type: [LeaderboardEntryDto] })
  entries: LeaderboardEntryDto[];
}
