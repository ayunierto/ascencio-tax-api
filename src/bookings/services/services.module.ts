import { Module } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Service } from './entities/';
import { AuthModule } from 'src/auth/auth.module';
import { StaffMember } from 'src/bookings/staff-members/entities/staff-member.entity';
import { Appointment } from 'src/bookings/appointments/entities/appointment.entity';
import { FilesModule } from 'src/files/files.module';

@Module({
  controllers: [ServicesController],
  providers: [ServicesService],
  imports: [
    TypeOrmModule.forFeature([Service, StaffMember, Appointment]),
    AuthModule,
    FilesModule,
  ],
  exports: [ServicesService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ServicesModule {}
