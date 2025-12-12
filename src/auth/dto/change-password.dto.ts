import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password', example: 'oldpassword123', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  currentPassword: string;

  @ApiProperty({ description: 'New password', example: 'newpassword123', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  newPassword: string;
}
