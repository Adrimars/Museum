import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class VerifyFinalCodeDto {
  @ApiProperty({ description: 'The final code the visitor decoded from the hunt' })
  @IsString()
  @MaxLength(50)
  code: string;
}
