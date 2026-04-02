import { Module } from '@nestjs/common';
import { PrinterService } from './printer.service';

@Module({
  providers: [PrinterService],
  exports: [PrinterService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class PrinterModule {}
