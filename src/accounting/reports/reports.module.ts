import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './entities/report.entity';
import { AuthModule } from 'src/auth/auth.module';
import { PrinterModule } from 'src/printer/printer.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { CategoriesModule } from '../categories/categories.module';
import { SubcategoriesModule } from '../subcategories/subcategories.module';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
  imports: [
    TypeOrmModule.forFeature([Report]),
    AuthModule,
    PrinterModule,
    ExpensesModule,
    CategoriesModule,
    SubcategoriesModule,
  ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ReportsModule {}
