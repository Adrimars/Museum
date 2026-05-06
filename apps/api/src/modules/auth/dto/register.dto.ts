import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import sanitizeHtml from 'sanitize-html';

export class RegisterDto {
  @ApiProperty({ example: 'visitor@example.com' })
  @IsEmail()
  @Transform(({ value }: { value: string }) => value.toLowerCase().trim())
  email!: string;

  @ApiProperty({
    example: 'SecureP@ss1',
    description: 'Min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char',
  })
  @IsString()
  @Length(8, 100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])/, {
    message:
      'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 digit, and 1 special character',
  })
  password!: string;

  @ApiProperty({ example: 'Jane Doe', minLength: 2, maxLength: 50 })
  @IsString()
  @Length(2, 50)
  @Transform(({ value }: { value: string }) => sanitizeHtml(value.trim(), { allowedTags: [] }))
  displayName!: string;

  @ApiProperty({ example: '1995-08-20', description: 'ISO 8601 date (YYYY-MM-DD)' })
  @IsDateString()
  dateOfBirth!: string;
}
