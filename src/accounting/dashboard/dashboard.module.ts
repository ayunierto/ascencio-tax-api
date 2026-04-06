import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { User } from '../../auth/entities/user.entity';
import { Appointment } from '../../bookings/appointments/entities/appointment.entity';
import { StaffMember } from '../../bookings/staff-members/entities/staff-member.entity';
import { Service } from 'src/bookings/services/entities';
import { DashboardController } from './dashboard.controller';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([User, Appointment, Service, StaffMember]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class DashboardModule {}
