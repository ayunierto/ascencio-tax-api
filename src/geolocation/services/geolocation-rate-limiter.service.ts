import { Injectable, OnModuleDestroy } from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  windowStartedAt: number;
}

export interface GeolocationRateLimitState {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterSeconds: number;
}

const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 30;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60 * 1000;

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }

  return Math.floor(numeric);
};

@Injectable()
export class GeolocationRateLimiterService implements OnModuleDestroy {
  private readonly entries = new Map<string, RateLimitEntry>();

  private readonly maxRequests = parsePositiveInteger(
    process.env.GEOLOCATION_RATE_LIMIT_MAX_REQUESTS,
    DEFAULT_RATE_LIMIT_MAX_REQUESTS,
  );

  private readonly windowMs = parsePositiveInteger(
    process.env.GEOLOCATION_RATE_LIMIT_WINDOW_MS,
    DEFAULT_RATE_LIMIT_WINDOW_MS,
  );

  private readonly cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredEntries();
      },
      Math.max(this.windowMs, 60 * 1000),
    );

    this.cleanupInterval.unref();
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }

  consume(ip: string): GeolocationRateLimitState {
    const now = Date.now();
    const current = this.entries.get(ip);

    if (!current || now - current.windowStartedAt >= this.windowMs) {
      this.entries.set(ip, {
        count: 1,
        windowStartedAt: now,
      });

      return {
        allowed: true,
        remaining: Math.max(this.maxRequests - 1, 0),
        limit: this.maxRequests,
        retryAfterSeconds: 0,
      };
    }

    if (current.count >= this.maxRequests) {
      const retryAfterMs = this.windowMs - (now - current.windowStartedAt);

      return {
        allowed: false,
        remaining: 0,
        limit: this.maxRequests,
        retryAfterSeconds: Math.ceil(Math.max(retryAfterMs, 0) / 1000),
      };
    }

    current.count += 1;

    return {
      allowed: true,
      remaining: Math.max(this.maxRequests - current.count, 0),
      limit: this.maxRequests,
      retryAfterSeconds: 0,
    };
  }

  private cleanupExpiredEntries() {
    const now = Date.now();
    for (const [key, entry] of this.entries.entries()) {
      if (now - entry.windowStartedAt >= this.windowMs) {
        this.entries.delete(key);
      }
    }
  }
}
