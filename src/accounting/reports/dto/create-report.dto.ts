import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateReportDto {
  @ApiProperty({ description: 'Start date for the report', example: '2023-01-01' })
  @IsString()
  startDate: string;

  @ApiProperty({ description: 'End date for the report', example: '2023-12-31' })
  @IsString()
  endDate: string;
}
