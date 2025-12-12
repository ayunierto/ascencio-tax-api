import { ApiProperty } from '@nestjs/swagger';
import { User } from 'src/auth/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Report ID', format: 'uuid' })
  id: string;

  @ManyToOne(() => User, (user) => user.reports, {
    onDelete: 'CASCADE',
  })
  user: User;

  @Column('timestamp with time zone')
  @ApiProperty({ description: 'Start date' })
  startDate: Date;

  @Column('timestamp with time zone')
  @ApiProperty({ description: 'End date' })
  endDate: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;
}
