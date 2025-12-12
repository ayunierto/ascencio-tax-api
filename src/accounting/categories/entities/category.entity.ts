import { ApiProperty } from '@nestjs/swagger';
import { Expense } from 'src/accounting/expenses/entities/expense.entity';
import { Subcategory } from 'src/accounting/subcategories/entities/subcategory.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'categories' })
export class Category {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Category ID', format: 'uuid' })
  id: string;

  @Column('text', { unique: true })
  @ApiProperty({ description: 'Category name' })
  name: string;

  @Column('text', { nullable: true })
  @ApiProperty({ description: 'Category description', nullable: true })
  description: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;

  // Relationships
  @OneToMany(() => Subcategory, (subcategory) => subcategory.category)
  subcategories: Subcategory[];

  @OneToMany(() => Expense, (expense) => expense.category)
  expenses: Expense[];
}
