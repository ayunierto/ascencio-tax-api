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
import { Appointment } from 'src/bookings/appointments/entities/appointment.entity';
import { StaffMember } from 'src/bookings/staff-members/entities/staff-member.entity';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: '' })
  description: string;

  @Column({ nullable: true })
  address: string;

  @Column('int', { nullable: true })
  durationMinutes: number;

  @Column({ default: true })
  isAvailableOnline: boolean;

  @Column({ nullable: true })
  imageUrl?: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: string;

  @UpdateDateColumn()
  updatedAt: string;

  @DeleteDateColumn()
  deletedAt: string;

  // Relationships
  @ManyToMany(() => StaffMember, (staffMember) => staffMember.services)
  staffMembers: StaffMember[];

  @OneToMany(() => Appointment, (appointment) => appointment.service)
  appointments: Appointment[];
}
