import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

export class CreateServiceDto {
  @ApiProperty({ description: 'Service name', example: 'Tax Consultation' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiProperty({ description: 'Service description', example: 'One-hour consultation for tax planning', required: false })
  @IsString()
  @IsOptional()
  description: string;

  @ApiProperty({ description: 'Service address', example: '123 Main St', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ description: 'Duration in minutes', example: 60, required: false })
  @IsInt()
  @IsOptional()
  durationMinutes?: number;

  @ApiProperty({ description: 'Is available online', example: true })
  @IsBoolean()
  isAvailableOnline: boolean;

  @ApiProperty({ description: 'Image URL', example: 'https://example.com/image.jpg', required: false })
  @IsString()
  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ description: 'Is active', example: true })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({ description: 'List of Staff IDs', example: ['uuid1', 'uuid2'], required: false })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  staffIds: string[];
}
