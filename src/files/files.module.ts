import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [FilesController],
  providers: [FilesService],
  imports: [AuthModule],
  exports: [FilesService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class FilesModule {}
