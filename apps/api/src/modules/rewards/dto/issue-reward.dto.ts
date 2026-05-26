import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsUUID } from 'class-validator';

export class IssueRewardDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty()
  @IsUUID()
  rewardId: string;

  @ApiPropertyOptional({ description: 'Context about how the reward was earned' })
  @IsOptional()
  @IsObject()
  earnedVia?: Record<string, unknown>;
}
