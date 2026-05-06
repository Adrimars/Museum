import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListUsersDto {
  @ApiPropertyOptional({ description: 'Opaque cursor from previous page' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ['user', 'content_editor', 'museum_admin', 'super_admin'] })
  @IsOptional()
  @IsString()
  @IsIn(['user', 'content_editor', 'museum_admin', 'super_admin'])
  role?: string;

  @ApiPropertyOptional({ description: 'Filter by museum UUID (super_admin only)' })
  @IsOptional()
  @IsUUID()
  museumId?: string;

  @ApiPropertyOptional({ description: 'Filter banned/active users' })
  @IsOptional()
  @Transform(({ value }: { value: string }) => value === 'true')
  @IsBoolean()
  isBanned?: boolean;

  @ApiPropertyOptional({ description: 'Search by display name or email (case-insensitive)' })
  @IsOptional()
  @IsString()
  search?: string;
}
