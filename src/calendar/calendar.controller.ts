import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { calendar_v3 } from 'googleapis';

interface ImportExternalEventsDto {
  startDateTime: string;
  endDateTime: string;
  calendarId?: string;
  defaultTimeZone?: string;
}

@Controller('calendar')
export class CalendarController {
  constructor(private readonly googleCalendarService: CalendarService) {}

  @Post('events')
  async createEvent(@Body() createCalendarEventDto: calendar_v3.Schema$Event) {
    const createdEvent = await this.googleCalendarService.createEvent(
      createCalendarEventDto,
    );
    return createdEvent;
  }

  @Get('events')
  async listEvents() {
    const listEvents = await this.googleCalendarService.listUpcomingEvents();
    return listEvents;
  }

  @Get('has-events/:timeMin/:timeMax')
  async hasEvents(
    @Query('timeMin') timeMin: string,
    @Query('timeMax') timeMax: string,
  ) {
    const events = await this.googleCalendarService.checkEventsInRange(
      timeMin,
      timeMax,
    );
    return events;
    // return { hasEvents: events.length > 0 };
  }

  @Post('import-external')
  async importExternalEvents(@Body() body: ImportExternalEventsDto) {
    return this.googleCalendarService.importExternalEventsInRange(body);
  }
}
