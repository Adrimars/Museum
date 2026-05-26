import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Difficulty } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MinLength, ValidateNested } from 'class-validator';

export class QuizOptionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  text: string;

  @ApiProperty({ description: 'Exactly one option in the array must be true' })
  @IsBoolean()
  isCorrect: boolean;
}

export class CreateQuizQuestionDto {
  @ApiProperty()
  @IsUUID()
  museumId: string;

  @ApiPropertyOptional({ description: 'Optional link to a specific artifact' })
  @IsOptional()
  @IsUUID()
  artifactId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  questionText: string;

  @ApiProperty({ type: [QuizOptionDto], minItems: 2 })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => QuizOptionDto)
  options: QuizOptionDto[];

  @ApiProperty({ enum: Difficulty })
  @IsEnum(Difficulty)
  difficulty: Difficulty;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  explanation?: string;
}
