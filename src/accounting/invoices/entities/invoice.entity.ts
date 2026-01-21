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

export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'canceled'
  | 'void';

@Entity({ name: 'invoices' })
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // User que genera la factura
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
  @Column({ name: 'user_id' })
  userId: string;

  // Company que emite la factura (auto-creada como "Sole Proprietor" si el usuario no tiene compañía)
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'from_company_id' })
  fromCompany: Company;
  @Column({ name: 'from_company_id' })
  fromCompanyId: string;

  // Client receiving the invoice (Bill To)
  @ManyToOne(() => Client, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'bill_to_client_id' })
  billToClient?: Client;
  @Column({ name: 'bill_to_client_id', nullable: true })
  billToClientId?: string;

  // Bill To fields (inline) - used when billToClientId is null
  @Column({ name: 'bill_to_name', nullable: true })
  billToName?: string;

  @Column({ name: 'bill_to_email', nullable: true })
  billToEmail?: string;

  @Column({ name: 'bill_to_phone', nullable: true })
  billToPhone?: string;

  @Column({ name: 'bill_to_address', nullable: true, type: 'text' })
  billToAddress?: string;

  @Column({ name: 'bill_to_city', nullable: true })
  billToCity?: string;

  @Column({ name: 'bill_to_province', nullable: true })
  billToProvince?: string;

  @Column({ name: 'bill_to_postal_code', nullable: true })
  billToPostalCode?: string;

  @Column({ name: 'bill_to_country', nullable: true })
  billToCountry?: string;

  // Invoice details
  @Column({ name: 'invoice_number', unique: true })
  invoiceNumber: string;

  @Column({ name: 'invoice_year' })
  invoiceYear: number;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  // When the invoice was issued (becomes immutable)
  @Column({
    name: 'issued_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  issuedAt?: string;

  // Line items
  @OneToMany(() => InvoiceLineItem, (item) => item.invoice, {
    cascade: true,
    eager: true,
  })
  lineItems: InvoiceLineItem[];

  // Financial fields
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

  @Column({ default: 'draft' })
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
