import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class IngestEventDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  eventType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  museumId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
