import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AddressDto {
  @ApiProperty({ example: '123 Museum Ave' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  street!: string;

  @ApiProperty({ example: 'Istanbul' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @ApiProperty({ example: 'Turkey' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  country!: string;

  @ApiPropertyOptional({ example: 41.0082 })
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ example: 28.9784 })
  @IsOptional()
  @IsLongitude()
  lng?: number;
}

export class CreateMuseumDto {
  @ApiProperty({ example: 'Istanbul Archaeological Museum' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'istanbul-archaeological-museum' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must contain only lowercase letters, digits, and hyphens' })
  slug!: string;

  @ApiPropertyOptional({ example: 'Home to thousands of artifacts...' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  logoUrl?: string;

  @ApiProperty({ type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;
}
