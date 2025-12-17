import {
  Column,
  CreateDateColumn,
  Entity,
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
import { ApiProperty } from '@nestjs/swagger';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Unique identifier of the user', format: 'uuid' })
  id: string;

  @Column()
  @ApiProperty({ description: 'First name of the user' })
  firstName: string;

  @Column()
  @ApiProperty({ description: 'Last name of the user' })
  lastName: string;

  @Column({ type: 'text', nullable: true })
  @ApiProperty({
    description: "URL to the user's profile image",
    nullable: true,
  })
  /**
   * URL to the user's profile image
   */
  imageUrl: string | null;

  @Column({ unique: true })
  @ApiProperty({ description: 'Email address of the user', uniqueItems: true })
  /**
   * Email address of the user
   */
  email: string;

  @Column()
  @ApiProperty({ description: 'Password of the user' })
  /**
   * Password of the user
   */
  password: string;

  @Column({ type: 'text', nullable: true })
  @ApiProperty({ description: 'Country code of the user', nullable: true })
  /**
   * Country code of the user
   */
  countryCode: string | null;

  @Column({ type: 'text', nullable: true })
  @ApiProperty({ description: 'Phone number of the user', nullable: true })
  /**
   * Phone number of the user
   */
  phoneNumber: string | null;

  @Column()
  @ApiProperty({ description: 'Time zone of the user' })
  /**
   * Time zone of the user
   */
  timeZone: string;

  @Column({ type: 'text', default: 'en-CA' })
  @ApiProperty({ description: 'Locale of the user', default: 'en-CA' })
  /**
   * Locale of the user
   */
  locale: string;

  @Column('bool', { default: true })
  @ApiProperty({ description: 'Is the user active?', default: true })
  isActive: boolean;

  @Column('text', {
    array: true,
    default: [Role.User],
  })
  @ApiProperty({ description: 'Roles of the user', default: [Role.User] })
  /**
   * Roles of the user
   */
  roles: Role[];

  @Column('bool', { default: false })
  @ApiProperty({ description: 'Is the user email verified?', default: false })
  /**
   * Is the user email verified?
   */
  isEmailVerified: boolean;

  @Column('text', { nullable: true })
  @ApiProperty({ description: 'Verification code of the user', nullable: true })
  /**
   * Verification code of the user
   */
  verificationCode: string | null;

  @Column('timestamp', { nullable: true })
  @ApiProperty({
    description: 'Verification code expiration date of the user',
    nullable: true,
  })
  verificationCodeExpiresAt: Date | null;

  @Column('text', { nullable: true })
  @ApiProperty({
    description: 'Password reset code of the user',
    nullable: true,
  })
  /**
   * Password reset code of the user
   */
  passwordResetCode: string | null;

  @Column('timestamp', { nullable: true })
  @ApiProperty({
    description: 'Password reset code expiration date of the user',
    nullable: true,
  })
  /**
   * Password reset code expiration date of the user
   */
  passwordResetExpiresAt: Date | null;

  @Column('timestamp with time zone', { nullable: true })
  @ApiProperty({ description: 'Last login date of the user', nullable: true })
  lastLoginAt: Date | null;

  @Column('timestamp with time zone', { nullable: true })
  @ApiProperty({ description: 'Deleted date of the user', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  @ApiProperty({ description: 'Created date of the user' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

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
}
