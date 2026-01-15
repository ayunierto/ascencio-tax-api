import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountReceivable } from './entities/account-receivable.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { PaginatedResponse } from '@ascencio/shared/interfaces';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { Company } from '../companies/entities/company.entity';

@Injectable()
export class AccountsReceivableService {
  constructor(
    @InjectRepository(AccountReceivable)
    private readonly arRepo: Repository<AccountReceivable>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  /**
   * Create an Account Receivable from an issued invoice
   */
  async createFromInvoice(
    invoice: Invoice,
    userId: string,
  ): Promise<AccountReceivable> {
    const ar = this.arRepo.create({
      userId,
      companyId: invoice.fromCompanyId,
      clientId: invoice.billToClientId!,
      invoiceId: invoice.id,
      originalAmount: invoice.total,
      paidAmount: 0,
      balance: invoice.total,
      status: 'open',
      dueDate: invoice.dueDate,
      paymentTerms: `Due ${invoice.dueDate}`,
    });

    return this.arRepo.save(ar);
  }

  /**
   * Validate user has access to company (multi-tenant security)
   */
  private async validateUserCompanyAccess(
    userId: string,
    companyId: string,
  ): Promise<Company> {
    const company = await this.companyRepo.findOne({
      where: { id: companyId, users: { id: userId } },
      relations: ['users'],
    });

    if (!company) {
      throw new ForbiddenException('User does not have access to this company');
    }

    return company;
  }

  /**
   * Get all accounts receivable for a company
   */
  async findAll(
    paginationDto: PaginationDto,
    userId: string,
    companyId: string,
    status?: string,
  ): Promise<PaginatedResponse<AccountReceivable>> {
    const { limit = 10, offset = 0 } = paginationDto;

    // Validate access
    await this.validateUserCompanyAccess(userId, companyId);

    const where: any = { userId, companyId };
    if (status && status !== 'all') {
      where.status = status;
    }

    const [items, total] = await this.arRepo.findAndCount({
      take: limit,
      skip: offset,
      where,
      relations: [
        'client',
        'invoice',
        'company',
        'payments',
        'payments.receipt',
      ],
      order: { createdAt: 'DESC' },
    });

    return {
      total,
      pages: Math.ceil(total / limit),
      items,
    };
  }

  /**
   * Get one account receivable
   */
  async findOne(userId: string, id: string): Promise<AccountReceivable> {
    const ar = await this.arRepo.findOne({
      where: { id, userId },
      relations: [
        'client',
        'invoice',
        'company',
        'payments',
        'payments.receipt',
      ],
    });

    if (!ar) {
      throw new NotFoundException('Account receivable not found');
    }

    // Validate access
    await this.validateUserCompanyAccess(userId, ar.companyId);

    return ar;
  }

  /**
   * Update AR after payment
   */
  async recordPayment(
    arId: string,
    paymentAmount: number,
  ): Promise<AccountReceivable> {
    const ar = await this.arRepo.findOne({ where: { id: arId } });
    if (!ar) {
      throw new NotFoundException('Account receivable not found');
    }

    ar.paidAmount = Number(ar.paidAmount) + paymentAmount;
    ar.balance = Number(ar.originalAmount) - Number(ar.paidAmount);

    // Update status
    if (ar.balance <= 0) {
      ar.status = 'paid';
      ar.balance = 0;
    } else {
      ar.status = 'partial';
    }

    // Check if overdue
    const today = new Date().toISOString().split('T')[0];
    if (ar.balance > 0 && ar.dueDate < today) {
      ar.status = 'overdue';
    }

    return this.arRepo.save(ar);
  }

  /**
   * Get aging report (clients who owe money)
   */
  async getAgingReport(userId: string, companyId: string) {
    await this.validateUserCompanyAccess(userId, companyId);

    const ars = await this.arRepo.find({
      where: { userId, companyId, status: 'open' },
      relations: ['client', 'invoice'],
      order: { dueDate: 'ASC' },
    });

    const today = new Date();
    const aging = {
      current: [] as AccountReceivable[],
      days30: [] as AccountReceivable[],
      days60: [] as AccountReceivable[],
      days90Plus: [] as AccountReceivable[],
    };

    ars.forEach((ar) => {
      const dueDate = new Date(ar.dueDate);
      const daysPastDue = Math.floor(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysPastDue < 0) {
        aging.current.push(ar);
      } else if (daysPastDue <= 30) {
        aging.days30.push(ar);
      } else if (daysPastDue <= 60) {
        aging.days60.push(ar);
      } else {
        aging.days90Plus.push(ar);
      }
    });

    return aging;
  }
}
