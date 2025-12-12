import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ description: 'First name', example: 'John', minLength: 3 })
  @IsString()
  @MinLength(3)
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Doe', minLength: 3 })
  @IsString()
  @MinLength(3)
  lastName: string;

  @ApiProperty({ description: 'Country code', example: '+1', required: false })
  @IsString()
  @IsOptional()
  countryCode?: string;

  @ApiProperty({ description: 'Phone number', example: '1234567890', required: false })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({ description: 'Password (optional)', example: 'newpassword123', required: false, minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  @IsOptional()
  password?: string;
}
