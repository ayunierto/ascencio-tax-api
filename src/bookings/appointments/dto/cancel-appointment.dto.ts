import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CancelAppointmentDto {
  @ApiProperty({
    description: 'Reason for cancellation',
    example: 'Scheduling conflict',
  })
  @IsString()
  @IsNotEmpty()
  cancellationReason: string;
}
