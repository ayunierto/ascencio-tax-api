import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Appointment } from 'src/bookings/appointments/entities/appointment.entity';
import { StaffMember } from 'src/bookings/staff-members/entities/staff-member.entity';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Service ID', format: 'uuid' })
  id: string;

  @Column()
  @ApiProperty({ description: 'Service name' })
  name: string;

  @Column({ default: '' })
  @ApiProperty({ description: 'Service description' })
  description: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Service address', nullable: true })
  address: string;

  @Column('int', { nullable: true })
  @ApiProperty({ description: 'Duration in minutes', nullable: true })
  durationMinutes: number;

  @Column({ default: true })
  @ApiProperty({ description: 'Is available online' })
  isAvailableOnline: boolean;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Image URL', nullable: true })
  imageUrl?: string;

  @Column({ default: true })
  @ApiProperty({ description: 'Is active' })
  isActive: boolean;

  @CreateDateColumn()
  @ApiProperty({ description: 'Creation date' })
  createdAt: string;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Last update date' })
  updatedAt: string;

  @Column('timestamp with time zone', { nullable: true })
  @ApiProperty({ description: 'Deletion date', nullable: true })
  deletedAt: string;

  // Relationships
  @ManyToMany(() => StaffMember, (staffMember) => staffMember.services)
  staffMembers: StaffMember[];

  @OneToMany(() => Appointment, (appointment) => appointment.service)
  appointments: Appointment[];
}
