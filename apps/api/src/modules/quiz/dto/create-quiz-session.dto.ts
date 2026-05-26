import { ApiProperty } from '@nestjs/swagger';
import { Difficulty } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class CreateQuizSessionDto {
  @ApiProperty({ description: 'ID of the museum to quiz about' })
  @IsUUID()
  museumId: string;

  @ApiProperty({ enum: Difficulty, description: 'Quiz difficulty tier' })
  @IsEnum(Difficulty)
  difficulty: Difficulty;
}
