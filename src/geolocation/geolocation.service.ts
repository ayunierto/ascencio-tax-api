import { Inject, Injectable, Logger } from '@nestjs/common';
import { isPrivateOrLocalIp } from 'src/common/utils/ip-extractor.util';
import {
  GEOLOCATION_PROVIDER,
  GeolocationLookupResult,
  GeolocationProviderAdapter,
} from './interfaces/geolocation-provider.interface';
import { GeolocationCacheService } from './services/geolocation-cache.service';

const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MS = 250;
const DEFAULT_CIRCUIT_FAILURE_THRESHOLD = 5;
const DEFAULT_CIRCUIT_OPEN_MS = 30 * 1000;

const parsePositiveInteger = (
  value: string | undefined,
  fallback: number,
  minimum = 1,
) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < minimum) {
    return fallback;
  }

  return Math.floor(numeric);
};

@Injectable()
export class GeolocationService {
  private readonly logger = new Logger(GeolocationService.name);

  private readonly retryAttempts = parsePositiveInteger(
    process.env.GEOLOCATION_RETRY_ATTEMPTS,
    DEFAULT_RETRY_ATTEMPTS,
  );

  private readonly retryDelayMs = parsePositiveInteger(
    process.env.GEOLOCATION_RETRY_DELAY_MS,
    DEFAULT_RETRY_DELAY_MS,
    0,
  );

  private readonly circuitFailureThreshold = parsePositiveInteger(
    process.env.GEOLOCATION_CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    DEFAULT_CIRCUIT_FAILURE_THRESHOLD,
  );

  private readonly circuitOpenMs = parsePositiveInteger(
    process.env.GEOLOCATION_CIRCUIT_BREAKER_OPEN_MS,
    DEFAULT_CIRCUIT_OPEN_MS,
  );

  private consecutiveFailures = 0;
  private circuitOpenedAt: number | null = null;

  constructor(
    @Inject(GEOLOCATION_PROVIDER)
    private readonly geolocationProvider: GeolocationProviderAdapter,
    private readonly geolocationCacheService: GeolocationCacheService,
  ) {}

  async lookupByClientIp(
    clientIp: string,
  ): Promise<GeolocationLookupResult | null> {
    if (!clientIp || isPrivateOrLocalIp(clientIp)) {
      return null;
    }

    const cached = this.geolocationCacheService.get(clientIp);
    if (cached) {
      return cached;
    }

    if (this.isCircuitOpen()) {
      this.logger.warn('Geolocation circuit breaker is open. Request skipped.');
      return null;
    }

    try {
      const lookup = await this.lookupWithRetry(clientIp);
      if (lookup) {
        this.geolocationCacheService.set(clientIp, lookup);
      }

      this.registerSuccess();
      return lookup;
    } catch (error) {
      this.registerFailure();
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Geolocation provider failed: ${message}`);
      return null;
    }
  }

  private async lookupWithRetry(
    clientIp: string,
  ): Promise<GeolocationLookupResult | null> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await this.geolocationProvider.lookupByIp(clientIp);
      } catch (error) {
        lastError = error;

        if (attempt < this.retryAttempts && this.retryDelayMs > 0) {
          await this.delay(this.retryDelayMs * attempt);
        }
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new Error('Geolocation provider failed without details');
  }

  private isCircuitOpen(): boolean {
    if (this.circuitOpenedAt === null) {
      return false;
    }

    if (Date.now() - this.circuitOpenedAt >= this.circuitOpenMs) {
      this.circuitOpenedAt = null;
      this.consecutiveFailures = 0;
      return false;
    }

    return true;
  }

  private registerFailure(): void {
    this.consecutiveFailures += 1;

    if (this.consecutiveFailures >= this.circuitFailureThreshold) {
      this.circuitOpenedAt = Date.now();
      this.logger.warn(
        `Geolocation circuit breaker opened after ${String(this.consecutiveFailures)} failures.`,
      );
    }
  }

  private registerSuccess(): void {
    this.consecutiveFailures = 0;
    this.circuitOpenedAt = null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
