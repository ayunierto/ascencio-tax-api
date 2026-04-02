import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Module({
  providers: [MailService],
  exports: [MailService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class MailModule {}
