import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class FlagMessageDto {
  @ApiProperty({ enum: ['flagged', 'dismissed'], description: 'New flag status' })
  @IsEnum(['flagged', 'dismissed'])
  flagStatus: 'flagged' | 'dismissed';
}
