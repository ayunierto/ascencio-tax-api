import { ApiProperty } from '@nestjs/swagger';

export class GeolocationResponseDto {
  @ApiProperty({
    nullable: true,
    example: '1',
    description: 'International calling code without plus symbol.',
  })
  callingCode: string | null;

  @ApiProperty({
    nullable: true,
    example: 'CA',
  })
  countryCode: string | null;

  @ApiProperty({
    nullable: true,
    example: 'Canada',
  })
  countryName: string | null;

  @ApiProperty({
    nullable: true,
    example: 'Toronto',
  })
  city: string | null;

  @ApiProperty({
    nullable: true,
    example: 43.65107,
  })
  latitude: number | null;

  @ApiProperty({
    nullable: true,
    example: -79.347015,
  })
  longitude: number | null;
}
