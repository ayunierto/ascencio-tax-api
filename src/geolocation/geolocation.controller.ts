import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { extractClientIp } from 'src/common/utils/ip-extractor.util';
import { GeolocationResponseDto } from './dto/geolocation-response.dto';
import { GeolocationService } from './geolocation.service';
import { GeolocationLookupResult } from './interfaces/geolocation-provider.interface';
import { GeolocationRateLimiterService } from './services/geolocation-rate-limiter.service';

@ApiTags('Geolocation')
@Controller('geolocation')
export class GeolocationController {
  constructor(
    private readonly geolocationService: GeolocationService,
    private readonly rateLimiterService: GeolocationRateLimiterService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Resolve country and calling code from the client public IP',
  })
  @ApiOkResponse({
    type: GeolocationResponseDto,
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many geolocation requests from this IP.',
  })
  async resolveClientGeolocation(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<GeolocationResponseDto> {
    const clientIp = extractClientIp(request);

    if (!clientIp) {
      return this.buildResponse(null);
    }

    const rateLimitState = this.rateLimiterService.consume(clientIp);

    response.setHeader('X-RateLimit-Limit', String(rateLimitState.limit));
    response.setHeader(
      'X-RateLimit-Remaining',
      String(rateLimitState.remaining),
    );

    if (!rateLimitState.allowed) {
      response.setHeader(
        'Retry-After',
        String(rateLimitState.retryAfterSeconds),
      );

      throw new HttpException(
        'Too many geolocation requests. Please retry later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const lookup = await this.geolocationService.lookupByClientIp(clientIp);
    return this.buildResponse(lookup);
  }

  private buildResponse(
    lookup: GeolocationLookupResult | null,
  ): GeolocationResponseDto {
    return {
      callingCode: lookup?.callingCode ?? null,
      countryCode: lookup?.countryCode ?? null,
      countryName: lookup?.countryName ?? null,
      city: lookup?.city ?? null,
      latitude: lookup?.latitude ?? null,
      longitude: lookup?.longitude ?? null,
    };
  }
}
