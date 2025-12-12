import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class VerifyEmailCodeDto {
  @ApiProperty({ description: 'Verification code', example: '123456', minLength: 6, maxLength: 6 })
  @IsString()
  @MinLength(6, { message: 'The code must have a minimum of 6 characters' })
  @MaxLength(6, { message: 'The code must have a maximum of 6 characters' })
  code: string;

  @ApiProperty({ description: 'Email address', example: 'john.doe@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
