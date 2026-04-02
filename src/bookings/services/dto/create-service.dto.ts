import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsString()
  @IsOptional()
  description: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsInt()
  @IsOptional()
  durationMinutes?: number;

  @IsBoolean()
  isAvailableOnline: boolean;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsBoolean()
  isActive: boolean;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  staffIds: string[];
}
