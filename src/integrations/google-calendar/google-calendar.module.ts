import { Module } from '@nestjs/common';
import { GoogleCalendarIntegrationService } from './google-calendar.service';

@Module({
  providers: [GoogleCalendarIntegrationService],
  exports: [GoogleCalendarIntegrationService],
})
export class GoogleCalendarIntegrationModule {}
