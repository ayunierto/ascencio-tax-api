import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
} from 'class-validator';

export class CreateMobileConfigDto {
  @ApiPropertyOptional({
    example: 'dxo9msgwu',
    description: 'Cloudinary cloud name used by mobile to resolve image URLs.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/i, {
    message: 'mobileConfigInvalidCloudinaryName',
  })
  cloudinaryCloudName?: string;

  @ApiPropertyOptional({
    example: '12345-abc.apps.googleusercontent.com',
    description: 'Google web client ID used for native Google Sign-In.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[\w.-]+\.apps\.googleusercontent\.com$/i, {
    message: 'mobileConfigInvalidGoogleClientId',
  })
  googleWebClientId?: string;

  @ApiPropertyOptional({
    example: 'https://apps.apple.com/app/idXXXXXXXXX',
  })
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'validationUrl' })
  appStoreUrl?: string;

  @ApiPropertyOptional({
    example: 'https://play.google.com/store/apps/details?id=com.example.app',
  })
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'validationUrl' })
  playStoreUrl?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'When true, this config becomes the active one for public API.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
