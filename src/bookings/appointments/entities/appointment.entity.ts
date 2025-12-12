import { ApiProperty } from '@nestjs/swagger';
import { User } from 'src/auth/entities/user.entity';
import { Service } from 'src/bookings/services/entities';
import { StaffMember } from 'src/bookings/staff-members/entities/staff-member.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Appointment ID', format: 'uuid' })
  id: string;

  @Column('timestamp with time zone')
  @ApiProperty({ description: 'Start time' })
  start: Date;

  @Column('timestamp with time zone')
  @ApiProperty({ description: 'End time' })
  end: Date;

  @Column()
  @ApiProperty({ description: 'Time zone' })
  timeZone: string;

  @Column({ default: 'confirmed' })
  @ApiProperty({ description: 'Appointment status', enum: ['pending', 'confirmed', 'cancelled', 'completed'] })
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';

  @Column({ nullable: true })
  @ApiProperty({ description: 'Comments', nullable: true })
  comments: string;

  @Column()
  @ApiProperty({ description: 'Calendar Event ID' })
  calendarEventId: string;

  @Column()
  @ApiProperty({ description: 'Zoom Meeting ID' })
  zoomMeetingId: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Zoom Meeting Link', nullable: true })
  zoomMeetingLink: string;

  @Column({ default: 'app' })
  // "enum[app, admin, imported, api]"
  @ApiProperty({ description: 'Source of the appointment', enum: ['app', 'admin', 'imported', 'api'] })
  source: 'app' | 'admin' | 'imported' | 'api';

  @Column({ type: 'varchar', length: 500, nullable: true })
  @ApiProperty({ description: 'Cancellation reason', nullable: true })
  cancellationReason?: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Cancelled at timestamp', nullable: true })
  cancelledAt?: Date; // Timestamp de cuándo se canceló

  @Column({ nullable: true })
  @ApiProperty({ description: 'Cancelled by', nullable: true })
  cancelledBy?: string; // 'user' | 'staff' | 'admin'

  // Relations
  @ManyToOne(() => Service, (service) => service.appointments)
  service: Service;

  @ManyToOne(() => User, (user) => user.appointments, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => StaffMember, (staffMember) => staffMember.appointments)
  staffMember: StaffMember;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;

  @Column('timestamp with time zone', { nullable: true })
  @ApiProperty({ description: 'Deletion date', nullable: true })
  deletedAt: Date;
}
