import { ApiProperty } from '@nestjs/swagger';
import { IsUrl } from 'class-validator';

export class AnalyzeExpenseDto {
  @ApiProperty({
    description: 'Receipt image URL to analyze',
    example: 'https://example.com/receipt.jpg',
  })
  @IsUrl()
  imageUrl: string;
}
