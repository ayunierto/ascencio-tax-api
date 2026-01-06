import { User } from 'src/auth/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'companies' })
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToMany(() => User, (user) => user.companies)
  @JoinTable()
  users: User[];

  @Column()
  name: string;

  @Column()
  legalName: string;

  @Column()
  businessNumber: string;

  @Column()
  address: string;

  @Column()
  city: string;

  @Column()
  province: string;

  @Column()
  postalCode: string;

  @Column()
  phone: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  payrollAccountNumber: string;

  @Column({ nullable: true })
  logoUrl?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: string;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: string;

  @DeleteDateColumn({ type: 'timestamp with time zone', nullable: true })
  deletedAt: string;
}
