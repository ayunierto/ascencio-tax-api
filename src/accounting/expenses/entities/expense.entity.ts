import { ApiProperty } from '@nestjs/swagger';
import { Category } from 'src/accounting/categories/entities/category.entity';
import { Subcategory } from 'src/accounting/subcategories/entities/subcategory.entity';
import { User } from 'src/auth/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'expenses' })
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Expense ID', format: 'uuid' })
  id: string;

  @Column('text')
  @ApiProperty({ description: 'Merchant name' })
  merchant: string;

  @Column('timestamp with time zone')
  @ApiProperty({ description: 'Expense date' })
  date: Date;

  @Column('decimal', { precision: 10, scale: 2 })
  @ApiProperty({ description: 'Total amount' })
  total: number;

  @Column('decimal', { precision: 10, scale: 2 })
  @ApiProperty({ description: 'Tax amount' })
  tax: number;

  @Column('text', {
    nullable: true,
  })
  @ApiProperty({ description: 'Receipt image URL', nullable: true })
  imageUrl: string | null;

  @Column('text', {
    nullable: true,
  })
  @ApiProperty({ description: 'Notes', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Category, (category) => category.expenses)
  category: Category;

  @ManyToOne(() => Subcategory, (subcategory) => subcategory.expenses)
  subcategory: Subcategory;

  @ManyToOne(() => User, (user) => user.expenses, { onDelete: 'CASCADE' })
  user: User;
}
