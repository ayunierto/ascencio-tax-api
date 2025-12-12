import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsUrl } from 'class-validator';
import { IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({ description: 'Merchant name', example: 'Office Depot' })
  @IsString()
  @MinLength(1)
  merchant: string;

  @ApiProperty({ description: 'Expense date', example: '2023-10-27T10:00:00Z' })
  @IsString()
  @IsISO8601()
  date: string;

  @ApiProperty({ description: 'Total amount', example: 150.50 })
  @IsNumber({ maxDecimalPlaces: 2 })
  total: number;

  @ApiProperty({ description: 'Tax amount', example: 15.05 })
  @IsNumber({ maxDecimalPlaces: 2 })
  tax: number;

  @ApiProperty({ description: 'Receipt image URL', example: 'https://example.com/receipt.jpg', required: false })
  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ description: 'Notes', example: 'Pens, paper, and ink', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ description: 'Category ID', format: 'uuid' })
  @IsString()
  categoryId: string;

  @ApiProperty({ description: 'Subcategory ID', format: 'uuid', required: false })
  @IsString()
  @IsOptional()
  subcategoryId?: string;
}
