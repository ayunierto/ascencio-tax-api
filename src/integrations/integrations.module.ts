import { Module } from '@nestjs/common';
import { GoogleCalendarIntegrationModule } from './google-calendar/google-calendar.module';
import { ZoomIntegrationModule } from './zoom/zoom.module';

@Module({
  imports: [GoogleCalendarIntegrationModule, ZoomIntegrationModule],
  exports: [GoogleCalendarIntegrationModule, ZoomIntegrationModule],
})
export class IntegrationsModule {}
