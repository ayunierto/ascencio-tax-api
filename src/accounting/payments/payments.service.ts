import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Receipt } from './entities/receipt.entity';
import { AccountsReceivableService } from '../accounts-receivable/accounts-receivable.service';
import { InvoicesService } from '../invoices/invoices.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Receipt)
    private readonly receiptRepo: Repository<Receipt>,
    private readonly arService: AccountsReceivableService,
    private readonly invoicesService: InvoicesService,
  ) {}

  /**
   * Generate receipt number
   */
  private async generateReceiptNumber(userId: string): Promise<{
    receiptNumber: string;
    receiptYear: number;
  }> {
    const currentYear = new Date().getFullYear();

    const lastReceipt = await this.receiptRepo.findOne({
      where: { payment: { recordedByUserId: userId } },
      relations: ['payment'],
      order: { receiptNumber: 'DESC' },
    });

    let nextNumber = 1;
    if (lastReceipt) {
      const parts = lastReceipt.receiptNumber.split('-');
      const lastNumber = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    const receiptNumber = `RCP-${currentYear}-${nextNumber.toString().padStart(4, '0')}`;
    return { receiptNumber, receiptYear: currentYear };
  }

  /**
   * Record a payment on an account receivable
   */
  async recordPayment(
    userId: string,
    accountReceivableId: string,
    paymentData: {
      amount: number;
      paymentDate: string;
      paymentMethod: string;
      reference?: string;
      notes?: string;
    },
  ): Promise<Payment> {
    // Get the AR
    const ar = await this.arService.findOne(userId, accountReceivableId);

    // Validate payment amount
    if (paymentData.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }

    if (paymentData.amount > Number(ar.balance)) {
      throw new BadRequestException(
        `Payment amount ($${paymentData.amount}) exceeds remaining balance ($${ar.balance})`,
      );
    }

    // Create payment
    const payment = this.paymentRepo.create({
      ...paymentData,
      accountReceivableId,
      recordedByUserId: userId,
      paymentMethod: paymentData.paymentMethod as any,
    });

    const savedPayment = await this.paymentRepo.save(payment);

    // Generate receipt
    const { receiptNumber, receiptYear } =
      await this.generateReceiptNumber(userId);
    const receipt = this.receiptRepo.create({
      paymentId: savedPayment.id,
      receiptNumber,
      receiptYear,
    });

    await this.receiptRepo.save(receipt);

    // Update AR
    await this.arService.recordPayment(accountReceivableId, paymentData.amount);

    // Update invoice
    await this.invoicesService.recordPayment(
      userId,
      ar.invoiceId,
      paymentData.amount,
      paymentData.paymentDate,
    );

    // Return payment with receipt
    return this.paymentRepo.findOne({
      where: { id: savedPayment.id },
      relations: ['receipt', 'accountReceivable', 'accountReceivable.client'],
    }) as Promise<Payment>;
  }

  /**
   * Get all payments for a user
   */
  async findAll(
    userId: string,
    accountReceivableId?: string,
  ): Promise<Payment[]> {
    const where: any = { recordedByUserId: userId };
    if (accountReceivableId) {
      where.accountReceivableId = accountReceivableId;
    }

    return this.paymentRepo.find({
      where,
      relations: ['receipt', 'accountReceivable', 'accountReceivable.client'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get one payment
   */
  async findOne(userId: string, id: string): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({
      where: { id, recordedByUserId: userId },
      relations: [
        'receipt',
        'accountReceivable',
        'accountReceivable.client',
        'accountReceivable.invoice',
      ],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }
}
