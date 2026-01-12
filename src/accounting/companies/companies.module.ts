import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { Company } from './entities/company.entity';
import { AuthModule } from '../../auth/auth.module';
import { FilesModule } from '../../files/files.module';

@Module({
  imports: [TypeOrmModule.forFeature([Company]), AuthModule, FilesModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class CompaniesModule {}
