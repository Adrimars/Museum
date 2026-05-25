import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateArtifactDto {
  @ApiProperty({ description: 'Museum this artifact belongs to', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  museumId!: string;

  @ApiProperty({ description: 'Artifact display name', example: 'Golden Sarcophagus of Ramesses II' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  name!: string;

  @ApiPropertyOptional({ description: 'Short description of the artifact' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Historical context and provenance' })
  @IsOptional()
  @IsString()
  historicalContext?: string;

  @ApiPropertyOptional({ description: 'Time period of origin', example: 'Late Bronze Age' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  period?: string;

  @ApiPropertyOptional({ description: 'Location in the museum', example: 'Room 3, East Wall' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  locationHint?: string;

  @ApiPropertyOptional({ description: 'CDN URL of the audio guide', example: 'https://cdn.example.com/audio.mp3' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  audioGuideUrl?: string;

  @ApiPropertyOptional({ description: 'Text transcript of the audio guide' })
  @IsOptional()
  @IsString()
  audioTranscript?: string;
}
