import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateSystemSettingDto {

  @ApiProperty({ description: 'Setting key', example: 'site_name' })
  @IsString()
  key: string;

  @ApiProperty({ description: 'Setting value', example: 'My Awesome Site' })
  @IsString()
  value: string;

  @ApiProperty({ description: 'Setting type', example: 'string' })
  @IsString()
  type: string;
}
