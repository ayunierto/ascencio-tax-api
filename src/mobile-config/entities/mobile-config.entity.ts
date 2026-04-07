import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Index('UQ_mobile_configs_single_active', ['isActive'], {
  unique: true,
  where: '"isActive" = true AND "deletedAt" IS NULL',
})
@Entity('mobile_configs')
export class MobileConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { nullable: true })
  cloudinaryCloudName: string | null;

  @Column('text', { nullable: true })
  googleWebClientId: string | null;

  @Column('text', { nullable: true })
  appStoreUrl: string | null;

  @Column('text', { nullable: true })
  playStoreUrl: string | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true, type: 'timestamp with time zone' })
  deletedAt?: Date | null;
}
