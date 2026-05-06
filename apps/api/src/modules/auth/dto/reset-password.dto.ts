import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Raw reset token from the email link' })
  @IsString()
  token!: string;

  @ApiProperty({ description: 'New password' })
  @IsString()
  @Length(8, 100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])/, {
    message:
      'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 digit, and 1 special character',
  })
  newPassword!: string;
}
