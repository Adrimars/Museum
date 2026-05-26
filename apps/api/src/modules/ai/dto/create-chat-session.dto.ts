import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class CreateChatSessionDto {
  @ApiProperty({ description: 'Museum ID this chat session belongs to' })
  @IsUUID()
  museumId: string;

  @ApiPropertyOptional({ description: 'Artifact to use as conversation context' })
  @IsOptional()
  @IsUUID()
  artifactContextId?: string;
}
