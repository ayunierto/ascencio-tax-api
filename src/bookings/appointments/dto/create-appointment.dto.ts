import {
  IsISO8601,
  IsOptional,
  IsString,
  IsTimeZone,
  IsUUID,
  IsDateString,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAppointmentDto {
  @ApiProperty({ description: 'Service ID', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({ description: 'Staff Member ID', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  staffId: string;

  @ApiProperty({
    description: 'Start date and time',
    example: '2023-10-27T10:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  start: string;

  @ApiProperty({
    description: 'End date and time',
    example: '2023-10-27T11:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  end: string;

  @ApiProperty({ description: 'Time zone', example: 'America/New_York' })
  @IsString()
  @IsNotEmpty()
  timeZone: string;

  @ApiProperty({
    description: 'Comments',
    example: 'I need help with my taxes',
    required: false,
  })
  @IsString()
  @IsOptional()
  comments?: string;

  @ApiProperty({
    description: 'Source of the appointment',
    example: 'app',
    enum: ['app', 'admin', 'imported', 'api'],
    required: false,
  })
  @IsString()
  @IsOptional()
  source?: 'app' | 'admin' | 'imported' | 'api';
}
