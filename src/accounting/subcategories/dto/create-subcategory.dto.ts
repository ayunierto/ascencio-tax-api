import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateSubcategoryDto {
  @ApiProperty({ description: 'Subcategory name', example: 'Pens & Pencils' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Category ID', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;
}
