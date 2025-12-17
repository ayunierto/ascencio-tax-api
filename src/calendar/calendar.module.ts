import { Module } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarEvent } from './entities/calendar.entity';
import { GoogleCalendarIntegrationModule } from 'src/integrations/google-calendar/google-calendar.module';

@Module({
  controllers: [CalendarController],
  providers: [CalendarService],
  imports: [
    TypeOrmModule.forFeature([CalendarEvent]),
    GoogleCalendarIntegrationModule,
  ],
  exports: [CalendarService, TypeOrmModule],
})
export class CalendarModule {}
