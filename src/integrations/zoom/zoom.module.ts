import { Module } from '@nestjs/common';
import { ZoomIntegrationService } from './zoom.service';

@Module({
  providers: [ZoomIntegrationService],
  exports: [ZoomIntegrationService],
})
export class ZoomIntegrationModule {}
