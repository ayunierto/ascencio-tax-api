import axios, { AxiosInstance } from 'axios';
import { Injectable, Logger } from '@nestjs/common';
import {
  GeolocationLookupResult,
  GeolocationProviderAdapter,
} from '../interfaces/geolocation-provider.interface';
import {
  IpApiErrorResponse,
  IpApiSuccessResponse,
} from '../interfaces/ipapi-response.interface';

const DEFAULT_TIMEOUT_MS = 5000;

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }

  return Math.floor(numeric);
};

@Injectable()
export class IpApiGeolocationAdapter implements GeolocationProviderAdapter {
  readonly name = 'ipapi';

  private readonly logger = new Logger(IpApiGeolocationAdapter.name);
  private readonly accessKey = process.env.IPAPI_ACCESS_KEY;
  private readonly timeoutMs = parsePositiveInteger(
    process.env.GEOLOCATION_PROVIDER_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  );
  private readonly httpClient: AxiosInstance = axios.create({
    baseURL: 'https://api.ipapi.com',
    timeout: this.timeoutMs,
  });

  private hasWarnedMissingAccessKey = false;

  async lookupByIp(ip: string): Promise<GeolocationLookupResult | null> {
    if (!this.accessKey) {
      if (!this.hasWarnedMissingAccessKey) {
        this.logger.warn(
          'IPAPI_ACCESS_KEY is not configured. Geolocation provider is disabled.',
        );
        this.hasWarnedMissingAccessKey = true;
      }
      return null;
    }

    try {
      const encodedIp = encodeURIComponent(ip);
      const response = await this.httpClient.get<
        IpApiSuccessResponse | IpApiErrorResponse
      >(`/${encodedIp}`, {
        params: { access_key: this.accessKey },
      });

      if (this.isErrorResponse(response.data)) {
        this.logger.warn(
          `ipapi returned an error: ${response.data.error?.type ?? 'unknown'}`,
        );
        return null;
      }

      return this.toLookupResult(response.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`IpApi request failed: ${message}`);
    }
  }

  private isErrorResponse(
    data: IpApiSuccessResponse | IpApiErrorResponse,
  ): data is IpApiErrorResponse {
    return 'success' in data;
  }

  private toLookupResult(data: IpApiSuccessResponse): GeolocationLookupResult {
    const rawCallingCode =
      data.location?.calling_code ?? data.country_calling_code ?? null;

    const normalizedCallingCode = rawCallingCode
      ? rawCallingCode.replace(/^\+/, '')
      : null;

    return {
      callingCode: normalizedCallingCode,
      countryCode: data.country_code ?? null,
      countryName: data.country_name ?? null,
      city: data.city ?? null,
      latitude: typeof data.latitude === 'number' ? data.latitude : null,
      longitude: typeof data.longitude === 'number' ? data.longitude : null,
    };
  }
}
