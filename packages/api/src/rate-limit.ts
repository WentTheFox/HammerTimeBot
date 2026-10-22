export interface RateLimitOptions {
  /** Requests per minute that are allowed on average, 0 turns the limit off */
  perMinute: number;
  /** How many requests may come in at once, before the average applies. Defaults to half a minute's worth. */
  burst?: number;
  /** Bounds the memory, the buckets that were used least recently are dropped */
  maxEntries?: number;
  /** Injectable for tests */
  now?: () => number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  /** Whole requests that can still be made right now */
  remaining: number;
  /** Seconds until the bucket is full again */
  resetSeconds: number;
  /** Seconds until one more request is allowed, 0 when it already is */
  retryAfterSeconds: number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/**
 * A token bucket per identity: a request spends a token and tokens come back at a steady rate, which allows short
 * bursts without allowing more than the average over time. The buckets are brought up to date when they are used, so
 * nothing runs in the background, and an idle bucket is simply a full one that gets dropped when the map is full.
 */
export class RateLimiter {
  readonly enabled: boolean;
  readonly limit: number;
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;
  private readonly buckets = new Map<string, Bucket>();

  constructor({ perMinute, burst, maxEntries = 50_000, now = Date.now }: RateLimitOptions) {
    this.enabled = perMinute > 0;
    this.limit = perMinute;
    this.capacity = Math.max(1, burst ?? Math.ceil(perMinute / 2));
    this.refillPerMs = perMinute / 60_000;
    this.maxEntries = maxEntries;
    this.now = now;
  }

  /** Spends a token when there is one */
  consume(id: string): RateLimitResult {
    return this.take(id, true);
  }

  /** Whether a request would be allowed, without spending anything */
  peek(id: string): RateLimitResult {
    return this.take(id, false);
  }

  private take(id: string, spend: boolean): RateLimitResult {
    if (!this.enabled) {
      return { allowed: true, limit: 0, remaining: Number.MAX_SAFE_INTEGER, resetSeconds: 0, retryAfterSeconds: 0 };
    }

    const now = this.now();
    const bucket = this.buckets.get(id) ?? { tokens: this.capacity, updatedAt: now };
    bucket.tokens = Math.min(this.capacity, bucket.tokens + Math.max(0, now - bucket.updatedAt) * this.refillPerMs);
    bucket.updatedAt = now;

    const allowed = bucket.tokens >= 1;
    if (allowed && spend) {
      bucket.tokens -= 1;
    }
    if (spend) {
      // Delete first so the bucket counts as the most recently used
      this.buckets.delete(id);
      this.buckets.set(id, bucket);
      this.evict();
    }

    return {
      allowed,
      limit: this.limit,
      remaining: Math.floor(bucket.tokens),
      resetSeconds: Math.ceil((this.capacity - bucket.tokens) / this.refillPerMs / 1000),
      retryAfterSeconds: allowed ? 0 : Math.ceil((1 - bucket.tokens) / this.refillPerMs / 1000),
    };
  }

  private evict(): void {
    while (this.buckets.size > this.maxEntries) {
      const oldest = this.buckets.keys().next();
      if (oldest.done) break;
      this.buckets.delete(oldest.value);
    }
  }
}

/** The IETF draft's RateLimit headers, so clients can pace themselves */
export const rateLimitHeaders = (result: RateLimitResult): Record<string, string> => {
  if (result.limit === 0) {
    return {};
  }

  return {
    'RateLimit-Limit': String(result.limit),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(result.resetSeconds),
    ...(result.allowed ? {} : { 'Retry-After': String(Math.max(1, result.retryAfterSeconds)) }),
  };
};

export interface RateLimits {
  /** Requests per API key, or per Discord account for the bot's service key */
  requests: RateLimiter;
  /** Failed authentications per client address, so bad keys do not each cost a lookup */
  authFailures: RateLimiter;
  /** Where the client address comes from */
  clientIp: (request: Request, socketAddress: string | undefined) => string;
}

export interface RateLimitConfig {
  requestsPerMinute?: number;
  requestsBurst?: number;
  authFailuresPerMinute?: number;
  /**
   * A header the reverse proxy sets to the address of the client and overwrites whatever the client sent, such as X-Real-IP.
   * Without one the address of the connection is used, which is the proxy's own address when there is one. Only set
   * it when the proxy really overwrites it, otherwise anyone can pick the address they are counted under.
   */
  clientIpHeader?: string;
  now?: () => number;
}

export const DEFAULT_REQUESTS_PER_MINUTE = 60;
export const DEFAULT_AUTH_FAILURES_PER_MINUTE = 20;

export const createRateLimits = ({
  requestsPerMinute = DEFAULT_REQUESTS_PER_MINUTE,
  requestsBurst,
  authFailuresPerMinute = DEFAULT_AUTH_FAILURES_PER_MINUTE,
  clientIpHeader,
  now,
}: RateLimitConfig = {}): RateLimits => ({
  requests: new RateLimiter({ perMinute: requestsPerMinute, burst: requestsBurst, now }),
  // As many failures at once as the limit says per minute, so "20 per minute" means 20 failures and then a wait
  authFailures: new RateLimiter({ perMinute: authFailuresPerMinute, burst: authFailuresPerMinute, now }),
  clientIp: (request, socketAddress) => {
    const header = clientIpHeader ? request.headers.get(clientIpHeader) : null;
    // X-Forwarded-For style lists put the client first
    return header?.split(',')[0]?.trim() || socketAddress || 'unknown';
  },
});
