import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ScanClueDto {
  @ApiProperty({ description: 'SHA-256 code hash from the scanned QR URL parameter' })
  @IsString()
  @Length(1, 128)
  codeHash: string;

  @ApiProperty({ description: 'Key ID (kid) from the scanned QR URL parameter' })
  @IsString()
  @Length(1, 50)
  kid: string;
}
