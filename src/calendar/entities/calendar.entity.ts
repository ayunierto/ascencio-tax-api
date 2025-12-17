import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type CalendarSourceType = 'appointment' | 'manual' | 'imported' | 'api';
export type CalendarStatus = 'confirmed' | 'cancelled';

@Entity()
export class CalendarEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  summary: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ nullable: true })
  location?: string;

  @Column('timestamp with time zone')
  start: Date;

  @Column('timestamp with time zone')
  end: Date;

  @Column({ default: 'UTC' })
  timeZone: string;

  @Column({ nullable: true })
  @Index()
  staffMemberId?: string;

  @Column({ nullable: true })
  serviceId?: string;

  @Column({ default: 'appointment' })
  sourceType: CalendarSourceType;

  @Column({ nullable: true })
  sourceId?: string;

  @Column({ nullable: true })
  externalEventId?: string;

  @Column({ nullable: true })
  externalCalendarId?: string;

  @Column({ default: true })
  isBusy: boolean;

  @Column({ default: 'confirmed' })
  status: CalendarStatus;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
