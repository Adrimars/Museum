import { ApiProperty } from '@nestjs/swagger';

export class GuestTokenResponseDto {
  @ApiProperty({ description: 'Bearer token for guest game session' })
  accessToken: string;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;
}
