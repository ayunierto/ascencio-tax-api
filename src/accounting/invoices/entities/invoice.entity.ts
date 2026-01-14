import { User } from 'src/auth/entities/user.entity';
import { Company } from 'src/accounting/companies/entities/company.entity';
import { Client } from 'src/accounting/clients/entities/client.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InvoiceLineItem } from './invoice-line-item.entity';

export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'canceled';

@Entity({ name: 'invoices' })
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  /** Company issuing the invoice (From) */
  @ManyToOne(() => Company, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'from_company_id' })
  fromCompany?: Company;

  @Column({ name: 'from_company_id', nullable: true })
  fromCompanyId?: string;

  /** Client receiving the invoice (Bill To) */
  @ManyToOne(() => Client, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'bill_to_client_id' })
  billToClient?: Client;

  @Column({ name: 'bill_to_client_id', nullable: true })
  billToClientId?: string;

  /** Invoice details */
  @Column({ name: 'invoice_number', unique: true })
  invoiceNumber: string;

  @Column({ name: 'invoice_year' })
  invoiceYear: number;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  /** Line items */
  @OneToMany(() => InvoiceLineItem, (item) => item.invoice, {
    cascade: true,
    eager: true,
  })
  lineItems: InvoiceLineItem[];

  /** Financial fields */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column({
    name: 'tax_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 13,
  })
  taxRate: number;

  @Column({
    name: 'tax_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total: number;

  @Column({
    name: 'amount_paid',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  amountPaid: number;

  @Column({
    name: 'balance_due',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  balanceDue: number;

  @Column({ default: 'pending' })
  status: InvoiceStatus;

  @Column({ name: 'paid_date', type: 'date', nullable: true })
  paidDate?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'logo_url', nullable: true })
  logoUrl?: string;

  @Column({ name: 'pdf_url', nullable: true })
  pdfUrl?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: string;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: string;

  @DeleteDateColumn({ type: 'timestamp with time zone', nullable: true })
  deletedAt?: string;
}
