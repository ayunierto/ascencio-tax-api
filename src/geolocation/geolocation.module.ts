import { Module } from '@nestjs/common';
import { GeolocationController } from './geolocation.controller';
import { GeolocationService } from './geolocation.service';
import { GEOLOCATION_PROVIDER } from './interfaces/geolocation-provider.interface';
import { IpApiGeolocationAdapter } from './adapters/ipapi-geolocation.adapter';
import { GeolocationCacheService } from './services/geolocation-cache.service';
import { GeolocationRateLimiterService } from './services/geolocation-rate-limiter.service';

@Module({
  controllers: [GeolocationController],
  providers: [
    GeolocationService,
    GeolocationCacheService,
    GeolocationRateLimiterService,
    IpApiGeolocationAdapter,
    {
      provide: GEOLOCATION_PROVIDER,
      useExisting: IpApiGeolocationAdapter,
    },
  ],
  exports: [GeolocationService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class GeolocationModule {}
