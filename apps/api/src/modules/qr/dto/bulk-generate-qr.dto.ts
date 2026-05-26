import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class BulkGenerateQrDto {
  @ApiPropertyOptional({
    description: 'Museum ID — required for super_admin, inferred from JWT for museum_admin.',
  })
  @IsOptional()
  @IsUUID()
  museumId?: string;
}
