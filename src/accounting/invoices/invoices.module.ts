import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { Invoice } from './entities/invoice.entity';
import { InvoiceLineItem } from './entities/invoice-line-item.entity';
import { Company } from '../companies/entities/company.entity';
import { Client } from '../clients/entities/client.entity';
import { AuthModule } from '../../auth/auth.module';
import { PrinterModule } from '../../printer/printer.module';
import { FilesModule } from '../../files/files.module';
import { AccountsReceivableModule } from '../accounts-receivable/accounts-receivable.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceLineItem, Company, Client]),
    AuthModule,
    PrinterModule,
    FilesModule,
    forwardRef(() => AccountsReceivableModule),
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
