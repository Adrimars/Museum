import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  ValidateNested,
} from 'class-validator';
import sanitizeHtml from 'sanitize-html';

export class AccessibilityPreferencesDto {
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  reducedMotion?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  highContrast?: boolean;
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ enum: ['tr', 'en'], example: 'tr' })
  @IsOptional()
  @IsString()
  @IsIn(['tr', 'en'])
  language?: string;

  @ApiPropertyOptional({ enum: ['easy', 'medium', 'hard'], example: 'medium' })
  @IsOptional()
  @IsString()
  @IsIn(['easy', 'medium', 'hard'])
  preferredDifficulty?: string;

  @ApiPropertyOptional({ type: AccessibilityPreferencesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AccessibilityPreferencesDto)
  accessibility?: AccessibilityPreferencesDto;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jane Doe', minLength: 2, maxLength: 50 })
  @IsOptional()
  @IsString()
  @Length(2, 50)
  @Transform(({ value }: { value: string }) => sanitizeHtml(value.trim(), { allowedTags: [] }))
  displayName?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatar.png' })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiPropertyOptional({ type: UpdatePreferencesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePreferencesDto)
  preferences?: UpdatePreferencesDto;
}
