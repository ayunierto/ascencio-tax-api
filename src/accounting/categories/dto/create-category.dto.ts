import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Category name', example: 'Office Supplies' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Category description', example: 'Expenses for office supplies', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
