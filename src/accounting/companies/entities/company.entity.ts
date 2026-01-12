import { User } from 'src/auth/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'companies' })
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToMany(() => User, (user) => user.companies)
  @JoinTable()
  users: User[];

  @Column()
  name: string;

  @Column()
  legalName: string;

  @Column()
  businessNumber: string;

  @Column()
  address: string;

  @Column()
  city: string;

  @Column()
  province: string;

  @Column()
  postalCode: string;

  @Column()
  phone: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  payrollAccountNumber: string;

  /**
   * The temporary media token (publicId) sent from the client.
   * Used during create/update to promote images from temp_files.
   * Not persisted after processing.
   */
  @Column({ nullable: true })
  mediaToken?: string;

  /**
   * The permanent Cloudinary public_id of the company logo.
   * Used for cleanup when replacing or deleting the logo.
   */
  @Column({ nullable: true })
  logoPublicId?: string;

  /**
   * The full secure URL of the company logo.
   * Stored for quick access without needing to construct the URL.
   */
  @Column({ nullable: true })
  logoUrl?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: string;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: string;

  @DeleteDateColumn({ type: 'timestamp with time zone', nullable: true })
  deletedAt: string;
}
