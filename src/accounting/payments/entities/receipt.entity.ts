import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Payment } from './payment.entity';

@Entity({ name: 'receipts' })
export class Receipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Payment this receipt is for */
  @OneToOne(() => Payment, (payment) => payment.receipt, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @Column({ name: 'payment_id', unique: true })
  paymentId: string;

  @Column({ name: 'receipt_number', unique: true })
  receiptNumber: string;

  @Column({ name: 'receipt_year' })
  receiptYear: number;

  @Column({ name: 'pdf_url', nullable: true })
  pdfUrl?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  issuedAt: string;
}
