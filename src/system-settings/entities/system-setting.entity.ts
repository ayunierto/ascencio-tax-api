import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('system_settings')
export class SystemSetting {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Unique identifier', format: 'uuid' })
  id: string;

  @Column()
  @ApiProperty({ description: 'Setting key' })
  key: string;

  @Column('text', { nullable: true })
  @ApiProperty({ description: 'Setting value', nullable: true })
  value: string | null;

  @Column('text')
  @ApiProperty({ description: 'Setting type' })
  type: string;

  // @Column()
  // timeZone: string;

  // @Column()
  // locale: string;

  // @Column({ default: false, type: 'bool' })
  // executedSeed: boolean;

  // @CreateDateColumn()
  // createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;
}
