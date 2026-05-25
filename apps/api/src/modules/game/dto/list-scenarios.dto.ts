import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListScenariosDto {
  @ApiPropertyOptional({ description: 'Filter by museum ID' })
  @IsOptional()
  @IsUUID()
  museumId?: string;
}
