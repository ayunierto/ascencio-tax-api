import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../enums/role.enum';
import { Log } from 'src/logs/entities/log.entity';
import { Post } from 'src/blog/posts/entities/post.entity';
import { Appointment } from 'src/bookings/appointments/entities/appointment.entity';
import { Expense } from 'src/accounting/expenses/entities/expense.entity';
import { Report } from 'src/accounting/reports/entities/report.entity';
import { Company } from 'src/accounting/companies/entities/company.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ type: 'text', nullable: true })
  imageUrl: string | null;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  countryCode: string | null;

  @Column({ type: 'text', nullable: true })
  phoneNumber: string | null;

  @Column()
  password: string;

  @Column()
  timeZone: string;

  @Column({ type: 'text', default: 'en-CA' })
  locale: string;

  @Column('bool', { default: true })
  isActive: boolean;

  @Column('text', {
    array: true,
    default: [Role.User],
  })
  roles: Role[];

  @Column('bool', { default: false })
  isEmailVerified: boolean;

  @Column('text', { nullable: true })
  verificationCode: string | null;

  @Column('timestamp', { nullable: true })
  verificationCodeExpiresAt: Date | null;

  @Column('text', { nullable: true })
  passwordResetCode: string | null;

  @Column('timestamp', { nullable: true })
  passwordResetExpiresAt: Date | null;

  @Column('timestamp with time zone', { nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp with time zone', nullable: true })
  deletedAt: Date | null;

  // Relationships
  @OneToMany(() => Log, (log) => log.user)
  logs: Log[];

  @OneToMany(() => Post, (post) => post.user)
  posts: Post[];

  @OneToMany(() => Appointment, (appointment) => appointment.user)
  appointments: Appointment[];

  @OneToMany(() => Expense, (expense) => expense.user)
  expenses: Expense[];

  @OneToMany(() => Report, (report) => report.user)
  reports: Report[];

  @ManyToMany(() => Company, (company) => company.users)
  companies: Company[];
}
