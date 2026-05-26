import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Difficulty } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ClueOptionDto {
  @ApiProperty()
  @IsString()
  text: string;

  @ApiProperty()
  isCorrect: boolean;
}

export class ClueQuestionInputDto {
  @ApiProperty()
  @IsString()
  text: string;

  @ApiProperty({ type: [ClueOptionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClueOptionDto)
  options: ClueOptionDto[];

  @ApiProperty()
  @IsString()
  hintText: string;
}

export class ClueInputDto {
  @ApiProperty()
  clueIndex: number;

  @ApiProperty()
  @IsString()
  narrativeText: string;

  @ApiProperty()
  @IsString()
  locationHint: string;

  @ApiProperty()
  @IsUUID()
  artifactId: string;

  @ApiProperty()
  @IsUUID()
  qrCodeId: string;

  @ApiProperty({ type: ClueQuestionInputDto })
  @ValidateNested()
  @Type(() => ClueQuestionInputDto)
  question: ClueQuestionInputDto;
}

export class CreateScenarioDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  storyIntro: string;

  @ApiProperty({ enum: Difficulty })
  @IsEnum(Difficulty)
  difficulty: Difficulty;

  @ApiProperty({ type: [ClueInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClueInputDto)
  clues: ClueInputDto[];

  @ApiProperty({ description: 'Code visitors must enter after completing all clues' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  finalCode: string;

  @ApiPropertyOptional({ description: 'Reward ID awarded on scenario completion' })
  @IsOptional()
  @IsUUID()
  rewardId?: string;

  // S-1: super_admin must supply museumId explicitly (non-admins inherit from JWT)
  @ApiPropertyOptional({ description: 'Required when the actor is super_admin' })
  @IsOptional()
  @IsUUID()
  museumId?: string;
}
