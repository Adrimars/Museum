import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RewardTriggerType, RewardType } from '@prisma/client';
import { IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreateRewardDto {
  @ApiProperty()
  @IsUUID()
  museumId: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ enum: RewardType })
  @IsEnum(RewardType)
  type: RewardType;

  @ApiPropertyOptional({ description: 'S3 URL for badge/certificate image' })
  @IsOptional()
  @IsString()
  assetUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: RewardTriggerType })
  @IsEnum(RewardTriggerType)
  triggerType: RewardTriggerType;

  @ApiPropertyOptional({ description: 'Config for the trigger (e.g. { minScore: 100 } for quiz_threshold)' })
  @IsOptional()
  @IsObject()
  triggerConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Link to a specific game scenario' })
  @IsOptional()
  @IsUUID()
  linkedScenarioId?: string;

  @ApiPropertyOptional({ description: 'Days until discount code expires (null = never)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  discountValidityDays?: number;
}
