import { Module } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarEvent } from './entities/calendar.entity';
import { GoogleCalendarIntegrationModule } from 'src/integrations/google-calendar/google-calendar.module';
import { StaffMember } from 'src/bookings/staff-members/entities/staff-member.entity';

@Module({
  controllers: [CalendarController],
  providers: [CalendarService],
  imports: [
    TypeOrmModule.forFeature([CalendarEvent, StaffMember]),
    GoogleCalendarIntegrationModule,
  ],
  exports: [CalendarService, TypeOrmModule],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class CalendarModule {}
