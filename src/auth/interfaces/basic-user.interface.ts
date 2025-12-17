import { ApiProperty } from '@nestjs/swagger';

export class BasicUser {
  @ApiProperty({ description: 'User ID', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'First name' })
  firstName: string;

  @ApiProperty({ description: 'Last name' })
  lastName: string;

  @ApiProperty({ description: 'Profile image URL', required: false })
  imageUrl?: string | null;

  @ApiProperty({ description: 'Email address' })
  email: string;

  @ApiProperty({ description: 'Country code', required: false })
  countryCode?: string;

  @ApiProperty({ description: 'Phone number', required: false })
  phoneNumber?: string;

  @ApiProperty({ description: 'Locale', required: false })
  locale?: string;

  @ApiProperty({ description: 'User roles', isArray: true, type: [String] })
  roles: string[];

  @ApiProperty({ description: 'Last login date', required: false })
  lastLoginAt?: Date;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Update date', required: false })
  updatedAt?: Date;
}
