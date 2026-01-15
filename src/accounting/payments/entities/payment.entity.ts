import { User } from 'src/auth/entities/user.entity';
import { AccountReceivable } from 'src/accounting/accounts-receivable/entities/account-receivable.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Receipt } from './receipt.entity';

export type PaymentMethod =
  | 'cash'
  | 'check'
  | 'transfer'
  | 'credit_card'
  | 'debit_card'
  | 'other';

@Entity({ name: 'payments' })
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** User who recorded the payment */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recorded_by_user_id' })
  recordedBy: User;

  @Column({ name: 'recorded_by_user_id' })
  recordedByUserId: string;

  /** Account receivable this payment is for */
  @ManyToOne(() => AccountReceivable, (ar) => ar.payments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'account_receivable_id' })
  accountReceivable: AccountReceivable;

  @Column({ name: 'account_receivable_id' })
  accountReceivableId: string;

  /** Payment details */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ name: 'payment_date', type: 'date' })
  paymentDate: string;

  @Column({ name: 'payment_method' })
  paymentMethod: PaymentMethod;

  @Column({ nullable: true })
  reference?: string; // Check number, transaction ID, etc.

  @Column({ type: 'text', nullable: true })
  notes?: string;

  /** Receipt generated for this payment */
  @OneToOne(() => Receipt, (receipt) => receipt.payment, {
    cascade: true,
    eager: true,
  })
  receipt?: Receipt;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: string;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: string;
}
