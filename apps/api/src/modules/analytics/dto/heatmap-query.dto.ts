import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class HeatmapQueryDto {
  @ApiPropertyOptional({ description: 'ISO date — start of window (default: 30 days ago)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date — end of window (default: now)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
