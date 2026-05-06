import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ValidateQrDto {
  @ApiProperty({
    description: 'HMAC-derived code hash extracted from the scanned QR URL (?codeHash=…)',
    example: 'a3f9b2c1d4e5…',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  codeHash!: string;

  @ApiProperty({
    description: 'Key ID identifying which HMAC secret was used (?kid=…)',
    example: 'v1',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  kid!: string;
}
