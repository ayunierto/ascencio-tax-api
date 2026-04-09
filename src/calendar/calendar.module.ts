import { Module } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarEvent } from './entities/calendar.entity';
import { CalendarConnection } from './entities/calendar-connection.entity';
import { GoogleCalendarIntegrationModule } from 'src/integrations/google-calendar/google-calendar.module';
import { StaffMember } from 'src/bookings/staff-members/entities/staff-member.entity';
import { User } from 'src/auth/entities/user.entity';
import { CalendarConnectionService } from './calendar-connection.service';
import { EncryptionService } from './encryption.service';

import { CalendarOauthService } from './calendar-oauth.service';

@Module({
  controllers: [CalendarController],
  providers: [
    CalendarService,
    CalendarConnectionService,
    EncryptionService,
    CalendarOauthService,
  ],
  imports: [
    TypeOrmModule.forFeature([
      CalendarEvent,
      CalendarConnection,
      StaffMember,
      User,
    ]),
    GoogleCalendarIntegrationModule,
  ],
  exports: [CalendarService, CalendarConnectionService, TypeOrmModule],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class CalendarModule {}
