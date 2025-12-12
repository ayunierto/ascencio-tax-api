import { Module } from '@nestjs/common';
import { SystemSettingsService } from './system-settings.service';
import { SystemSettingsController } from './system-settings.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemSetting } from './entities/system-setting.entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [SystemSettingsController],
  providers: [SystemSettingsService],
  imports: [TypeOrmModule.forFeature([SystemSetting]), AuthModule],
  exports: [SystemSettingsService],
})
export class SystemSettingsModule {}
