import { Module } from '@nestjs/common';
import { ZoomIntegrationService } from './zoom.service';

@Module({
  providers: [ZoomIntegrationService],
  exports: [ZoomIntegrationService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ZoomIntegrationModule {}
