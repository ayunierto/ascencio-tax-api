import { Module } from '@nestjs/common';
import { ZoomService } from './zoom.service';
import { ZoomController } from './zoom.controller';

@Module({
  controllers: [ZoomController],
  providers: [ZoomService],
  exports: [ZoomService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ZoomModule {}
