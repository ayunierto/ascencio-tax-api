import { Module } from '@nestjs/common';
import { GoogleCalendarIntegrationService } from './google-calendar.service';

@Module({
  providers: [GoogleCalendarIntegrationService],
  exports: [GoogleCalendarIntegrationService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class GoogleCalendarIntegrationModule {}
