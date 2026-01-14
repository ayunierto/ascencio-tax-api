import { User } from 'src/auth/entities/user.entity';
import { Company } from 'src/accounting/companies/entities/company.entity';
import { Client } from 'src/accounting/clients/entities/client.entity';
import { Invoice } from 'src/accounting/invoices/entities/invoice.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Payment } from '../../payments/entities/payment.entity';

export type AccountReceivableStatus = 'open' | 'partial' | 'paid' | 'overdue' | 'written_off';

@Entity({ name: 'accounts_receivable' })
export class AccountReceivable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  /** Company that issued the invoice (tenant) */
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'company_id' })
  companyId: string;

  /** Client who owes money */
  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ name: 'client_id' })
  clientId: string;

  /** Associated invoice (1:1 relationship) */
  @OneToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ name: 'invoice_id', unique: true })
  invoiceId: string;

  /** Financial fields */
  @Column({ name: 'original_amount', type: 'decimal', precision: 10, scale: 2 })
  originalAmount: number;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  paidAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  balance: number;

  @Column({ default: 'open' })
  status: AccountReceivableStatus;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ name: 'payment_terms', nullable: true })
  paymentTerms?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  /** Payments made against this AR */
  @OneToMany(() => Payment, (payment) => payment.accountReceivable, { cascade: true })
  payments: Payment[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: string;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: string;

  @DeleteDateColumn({ type: 'timestamp with time zone', nullable: true })
  deletedAt?: string;
}
