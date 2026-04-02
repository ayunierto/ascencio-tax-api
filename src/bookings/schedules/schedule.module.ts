import { Module } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Schedule } from './entities/schedule.entity';
import { StaffMember } from '../staff-members/entities/staff-member.entity';

@Module({
  controllers: [ScheduleController],
  providers: [ScheduleService],
  imports: [TypeOrmModule.forFeature([Schedule, StaffMember])],
  exports: [ScheduleService, TypeOrmModule],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ScheduleModule {}
