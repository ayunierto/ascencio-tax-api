import { Module } from '@nestjs/common';
import { ZoomIntegrationModule } from './zoom/zoom.module';

@Module({
  imports: [ZoomIntegrationModule],
  exports: [ZoomIntegrationModule],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class IntegrationsModule {}
