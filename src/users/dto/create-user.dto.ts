import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsTimeZone,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from 'src/auth/enums/role.enum';

export class CreateUserDto {
  @ApiProperty({ description: 'First name', example: 'John', minLength: 3 })
  @IsString()
  @MinLength(3)
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Doe', minLength: 3 })
  @IsString()
  @MinLength(3)
  lastName: string;

  @ApiProperty({ description: 'Email address', example: 'john.doe@example.com' })
  @IsString()
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Country code', example: '+1', required: false })
  @IsOptional()
  countryCode?: string;

  @ApiProperty({ description: 'Phone number', example: '1234567890', required: false })
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({ description: 'Time zone', example: 'America/New_York' })
  @IsTimeZone()
  timeZone: string;

  @ApiProperty({ description: 'Locale', example: 'en-US', required: false })
  @IsString()
  @IsOptional()
  locale?: string;

  @ApiProperty({ description: 'Profile image URL', required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ description: 'Is email verified?', default: false, required: false })
  @IsOptional()
  @IsBoolean()
  isEmailVerified?: boolean;

  @ApiProperty({ description: 'Password', example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  // @Matches(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
  //   message:
  //     'The password must have a Uppercase, lowercase letter and a number',
  // })
  password: string;

  @ApiProperty({ description: 'Is active?', default: true })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({ description: 'User roles', enum: Role, isArray: true, required: false })
  @IsString({ each: true })
  @IsArray()
  @IsOptional()
  roles: Role[];
}
