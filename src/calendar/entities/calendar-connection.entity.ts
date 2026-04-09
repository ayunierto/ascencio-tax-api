import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export type CalendarActorType = 'company' | 'staff' | 'client';
export type CalendarProviderType = 'google';

@Entity()
@Index(['actorType', 'actorId', 'provider'], { unique: true })
export class CalendarConnection {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ enum: ['company', 'staff', 'client'] })
  @Column()
  actorType!: CalendarActorType;

  /** staffMemberId, clientId, or 'company' */
  @ApiProperty()
  @Column()
  @Index()
  actorId!: string;

  @ApiProperty({ enum: ['google'] })
  @Column({ default: 'google' })
  provider!: CalendarProviderType;

  /** Which Google Calendar to read/write */
  @ApiProperty()
  @Column({ nullable: true })
  calendarId?: string;

  /** AES-256-GCM encrypted JSON: { iv, authTag, ciphertext } */
  @Column({ type: 'text', nullable: true, select: false })
  encryptedAccessToken?: string;

  /** AES-256-GCM encrypted JSON: { iv, authTag, ciphertext } */
  @Column({ type: 'text', nullable: true, select: false })
  encryptedRefreshToken?: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  tokenExpiry?: Date;

  /** Google push notification channel ID */
  @Column({ nullable: true })
  webhookChannelId?: string;

  /** Google push notification resource ID */
  @Column({ nullable: true })
  webhookResourceId?: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  webhookExpiry?: Date;

  @ApiProperty()
  @Column({ default: true })
  isActive!: boolean;

  @ApiProperty()
  @Column({ nullable: true })
  connectedEmail?: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date;
}
