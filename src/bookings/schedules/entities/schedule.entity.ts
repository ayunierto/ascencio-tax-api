import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Matches } from 'class-validator';
import { StaffMember } from 'src/bookings/staff-members/entities/staff-member.entity';

@Entity('schedules')
export class Schedule {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Schedule ID', format: 'uuid' })
  id: string;

  @Column('integer')
  @ApiProperty({ description: 'Day of the week (0=Sunday, 6=Saturday)' })
  dayOfWeek: number; // 0=Sunday, 1=Monday, ..., 6=Saturday

  @Column()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Invalid end time format, should be HH:mm',
  })
  @ApiProperty({ description: 'Start time (HH:mm)' })
  startTime: string; // HH:mm

  @Column()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Invalid end time format, should be HH:mm',
  })
  @ApiProperty({ description: 'End time (HH:mm)' })
  endTime: string; // HH:mm

  // Relationships
  @ManyToMany(() => StaffMember, (staffMember) => staffMember.schedules)
  staffMembers: StaffMember[];

  @CreateDateColumn()
  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;
}
