import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { GeolocationLookupResult } from '../interfaces/geolocation-provider.interface';

interface CacheEntry {
  value: GeolocationLookupResult;
  expiresAt: number;
}

const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }

  return Math.floor(numeric);
};

@Injectable()
export class GeolocationCacheService implements OnModuleDestroy {
  private readonly cache = new Map<string, CacheEntry>();

  private readonly ttlMs = parsePositiveInteger(
    process.env.GEOLOCATION_CACHE_TTL_MS,
    DEFAULT_CACHE_TTL_MS,
  );

  private readonly cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredEntries();
      },
      Math.min(this.ttlMs, 60 * 60 * 1000),
    );

    this.cleanupInterval.unref();
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }

  get(ip: string): GeolocationLookupResult | null {
    const cacheEntry = this.cache.get(ip);
    if (!cacheEntry) {
      return null;
    }

    if (cacheEntry.expiresAt <= Date.now()) {
      this.cache.delete(ip);
      return null;
    }

    return cacheEntry.value;
  }

  set(ip: string, value: GeolocationLookupResult): void {
    this.cache.set(ip, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }
}
