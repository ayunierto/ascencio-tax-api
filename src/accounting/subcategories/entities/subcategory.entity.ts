import { ApiProperty } from '@nestjs/swagger';
import { Category } from 'src/accounting/categories/entities/category.entity';
import { Expense } from 'src/accounting/expenses/entities/expense.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'subcategories' })
export class Subcategory {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Subcategory ID', format: 'uuid' })
  id: string;

  @Column('text', { unique: true })
  @ApiProperty({ description: 'Subcategory name' })
  name: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Category, (category) => category.subcategories, {
    onDelete: 'CASCADE',
  })
  category: Category;

  @OneToMany(() => Expense, (expense) => expense.subcategory)
  expenses: Expense[];
}
