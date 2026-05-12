import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

// Accepted MIME types per PRD §8.11.2
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const ACCEPTED_AUDIO_TYPES = ['audio/mpeg', 'audio/aac', 'audio/ogg'] as const;
export const ACCEPTED_MIME_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_AUDIO_TYPES] as const;

// Upload contexts per PRD §8.11.5
const UPLOAD_CONTEXTS = ['avatar', 'artifact_image', 'audio_guide', 'reward_asset'] as const;
export type UploadContext = (typeof UPLOAD_CONTEXTS)[number];

// File size limits per PRD §8.11.2
export const MAX_SIZES: Record<UploadContext, number> = {
  avatar: 2 * 1024 * 1024,           // 2 MB
  artifact_image: 15 * 1024 * 1024,  // 15 MB
  audio_guide: 50 * 1024 * 1024,     // 50 MB
  reward_asset: 2 * 1024 * 1024,     // 2 MB (badge/certificate images — same as avatar)
};

export class PresignDto {
  @ApiProperty({ description: 'Original file name', example: 'artifact-photo.jpg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ description: 'File size in bytes', example: 1048576 })
  @IsInt()
  @Min(1)
  @Max(50 * 1024 * 1024) // hard ceiling at 50 MB (audio_guide limit)
  fileSize!: number;

  @ApiProperty({
    description: 'MIME type of the file',
    example: 'image/jpeg',
    enum: ACCEPTED_MIME_TYPES,
  })
  @IsString()
  @IsIn(ACCEPTED_MIME_TYPES)
  mimeType!: string;

  @ApiProperty({
    description: 'Upload context determines size limits and storage path',
    example: 'artifact_image',
    enum: UPLOAD_CONTEXTS,
  })
  @IsString()
  @IsIn(UPLOAD_CONTEXTS)
  context!: UploadContext;

  @ApiProperty({ description: 'Target museum UUID (required for artifact_image, audio_guide, reward_asset)', required: false })
  @IsOptional()
  @IsUUID('4')
  museumId?: string;

  @ApiProperty({ description: 'Target artifact UUID (required for artifact_image, audio_guide)', required: false })
  @IsOptional()
  @IsUUID('4')
  artifactId?: string;
}
