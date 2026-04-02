import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Payment } from './entities/payment.entity';
import { Receipt } from './entities/receipt.entity';
import { AccountsReceivableModule } from '../accounts-receivable/accounts-receivable.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Receipt]),
    forwardRef(() => AccountsReceivableModule),
    forwardRef(() => InvoicesModule),
    AuthModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class PaymentsModule {}
