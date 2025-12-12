import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, IsTimeZone, IsUUID } from 'class-validator';

export class SearchAvailabilityDto {
  @ApiProperty({ description: 'Service ID', format: 'uuid' })
  @IsUUID()
  serviceId: string;

  @ApiProperty({ description: 'Staff Member ID', format: 'uuid', required: false })
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @ApiProperty({ description: 'Date to check availability', example: '2023-10-27' })
  @IsISO8601()
  date: string;

  @ApiProperty({ description: 'Time zone', example: 'America/New_York' })
  @IsString()
  @IsTimeZone()
  timeZone: string; // IANA, ej. "America/Lima", "America/Toronto", etc.
}
