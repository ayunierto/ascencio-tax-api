import { Module } from '@nestjs/common';
import { LogsService } from './logs.service';
import { LogsController } from './logs.controller';
import { Log } from './entities/log.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [LogsController],
  providers: [LogsService],
  imports: [TypeOrmModule.forFeature([Log]), AuthModule],
  exports: [TypeOrmModule, LogsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class LogsModule {}
