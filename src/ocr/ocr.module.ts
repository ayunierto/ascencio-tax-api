import { Module } from '@nestjs/common';
import { OcrService } from './ocr.service';
import { OcrController } from './ocr.controller';

@Module({
  controllers: [OcrController],
  providers: [OcrService],
  exports: [OcrService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class OcrModule {}
