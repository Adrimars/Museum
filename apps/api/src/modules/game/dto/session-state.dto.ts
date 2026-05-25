import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClueQuestionDto {
  @ApiProperty()
  text: string;

  @ApiProperty({ type: [String] })
  options: string[];

  @ApiPropertyOptional({ nullable: true })
  hint: string | null;
}

export class CurrentClueDto {
  @ApiProperty()
  clueIndex: number;

  @ApiProperty()
  narrativeText: string;

  @ApiProperty()
  locationHint: string;

  @ApiPropertyOptional({ type: ClueQuestionDto, nullable: true })
  question: ClueQuestionDto | null;
}

export class SessionStateDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  state: string;

  @ApiProperty()
  scenarioId: string;

  @ApiProperty()
  currentClueIndex: number;

  @ApiProperty()
  totalClues: number;

  @ApiProperty()
  score: number;

  @ApiProperty()
  attemptsOnCurrentClue: number;

  @ApiPropertyOptional({ nullable: true })
  storyIntro: string | null;

  @ApiPropertyOptional({ type: CurrentClueDto, nullable: true })
  currentClue: CurrentClueDto | null;

  @ApiPropertyOptional({ nullable: true })
  completedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
