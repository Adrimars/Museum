import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContentStatus, Difficulty } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';

import { QuizOptionDto } from './create-quiz-question.dto';

export class UpdateQuizQuestionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(5)
  questionText?: string;

  @ApiPropertyOptional({ type: [QuizOptionDto], minItems: 2 })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => QuizOptionDto)
  options?: QuizOptionDto[];

  @ApiPropertyOptional({ enum: Difficulty })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  explanation?: string;

  @ApiPropertyOptional({ enum: ContentStatus, description: 'Only museum_admin+ can set to published' })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}
