import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({ description: 'Published game scenario ID to play' })
  @IsUUID()
  scenarioId: string;
}
