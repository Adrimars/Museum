import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class LeaderboardQueryDto {
  @ApiPropertyOptional({ enum: ['all_time', 'weekly', 'monthly'], default: 'all_time' })
  @IsOptional()
  @IsIn(['all_time', 'weekly', 'monthly'])
  period?: 'all_time' | 'weekly' | 'monthly' = 'all_time';

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
