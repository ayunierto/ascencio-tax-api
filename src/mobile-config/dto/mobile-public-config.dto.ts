import { ApiProperty } from '@nestjs/swagger';

export class MobilePublicConfigDto {
  @ApiProperty({
    nullable: true,
    example: 'dxo9msgwu',
    description: 'Cloudinary cloud name used to build public URLs on mobile.',
  })
  cloudinaryCloudName: string | null;

  @ApiProperty({
    nullable: true,
    example: '12345-abc.apps.googleusercontent.com',
    description: 'Google OAuth web client id used by native mobile sign-in.',
  })
  googleWebClientId: string | null;

  @ApiProperty({
    nullable: true,
    example: 'https://apps.apple.com/app/idXXXXXXXXX',
  })
  appStoreUrl: string | null;

  @ApiProperty({
    nullable: true,
    example: 'https://play.google.com/store/apps/details?id=com.example.app',
  })
  playStoreUrl: string | null;

  @ApiProperty({
    example: '2026-04-06T15:30:00.000Z',
    description: 'Server timestamp when this payload was generated.',
  })
  updatedAt: string;
}
