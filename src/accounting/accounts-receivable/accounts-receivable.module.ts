import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsReceivableService } from './accounts-receivable.service';
import { AccountsReceivableController } from './accounts-receivable.controller';
import { AccountReceivable } from './entities/account-receivable.entity';
import { Company } from '../companies/entities/company.entity';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccountReceivable, Company]),
    AuthModule,
  ],
  controllers: [AccountsReceivableController],
  providers: [AccountsReceivableService],
  exports: [AccountsReceivableService],
})
export class AccountsReceivableModule {}
