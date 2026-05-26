import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

export class LinkGuestDto {
  @ApiProperty({ description: 'The guest JWT obtained before registration' })
  @IsJWT()
  guestToken: string;
}
