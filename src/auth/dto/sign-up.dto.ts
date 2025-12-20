import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
  MinLength,
} from 'class-validator';

export class SignUpDto {
  @ApiProperty({ description: 'First name of the user', example: 'John' })
  @IsString()
  @MinLength(3, { message: 'The name must have a minimum of 3 characters' })
  firstName: string;

  @ApiProperty({ description: 'Last name of the user', example: 'Doe' })
  @IsString()
  @MinLength(3, {
    message: 'The last name must have a minimum of 3 characters',
  })
  lastName: string;

  @ApiProperty({
    description: 'Email address of the user',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Password of the user',
    example: 'password123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ description: 'Country code', example: '+1', required: false })
  @IsString()
  @IsOptional()
  countryCode?: string;

  @ApiProperty({
    description: 'Phone number',
    example: '1234567890',
    required: false,
  })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({
    description: 'Time zone of the user',
    example: 'America/New_York',
  })
  @IsTimeZone()
  timeZone: string;

  @ApiProperty({
    description: 'Locale preference',
    example: 'en-US',
    required: false,
  })
  @IsString()
  @IsOptional()
  locale?: string;
}
