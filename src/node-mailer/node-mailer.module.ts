import { Module } from '@nestjs/common';
import { NodeMailerService } from './node-mailer.service';

@Module({
  providers: [NodeMailerService],
  exports: [NodeMailerService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class NodeMailerModule {}
