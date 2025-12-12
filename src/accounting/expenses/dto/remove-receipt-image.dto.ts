import { ApiProperty } from '@nestjs/swagger';
import { IsUrl } from 'class-validator';

export class RemoveReceiptImageDto {
  @ApiProperty({ description: 'Receipt image URL to remove', example: 'https://example.com/receipt.jpg' })
  @IsUrl()
  imageUrl: string;
}
