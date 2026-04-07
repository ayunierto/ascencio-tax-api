import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { MobileConfigController } from './mobile-config.controller';
import { MobileConfigService } from './mobile-config.service';
import { MobileConfig } from './entities/mobile-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MobileConfig]), AuthModule],
  controllers: [MobileConfigController],
  providers: [MobileConfigService],
  exports: [MobileConfigService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class MobileConfigModule {}
