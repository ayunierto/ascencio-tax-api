import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Matches } from 'class-validator';

export class CreateScheduleDto {
  @ApiProperty({ description: 'Day of the week (0=Sunday, 6=Saturday)', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  dayOfWeek: number; // 0=Sunday, 1=Monday, ..., 6=Saturday

  @ApiProperty({ description: 'Start time (HH:mm)', example: '09:00' })
  @IsNotEmpty()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Invalid Time Format. It must be HH:mm',
  })
  startTime: string;

  @ApiProperty({ description: 'End time (HH:mm)', example: '17:00' })
  @IsNotEmpty()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Invalid Time Format. It must be HH:mm',
  })
  endTime: string;
}
