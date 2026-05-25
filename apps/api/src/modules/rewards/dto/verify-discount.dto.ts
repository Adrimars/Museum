import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class VerifyDiscountDto {
  @ApiProperty({ description: '8-character uppercase alphanumeric discount code' })
  @IsString()
  @Length(8, 8)
  @Matches(/^[A-Z0-9]{8}$/)
  code: string;
}
