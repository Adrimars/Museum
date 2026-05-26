import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateArtifactDto {
  @ApiPropertyOptional({ example: 'Golden Sarcophagus of Ramesses II' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  historicalContext?: string;

  @ApiPropertyOptional({ example: 'Late Bronze Age' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  period?: string;

  @ApiPropertyOptional({ example: 'Room 3, East Wall' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  locationHint?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  audioGuideUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  audioTranscript?: string;
}
