import { Redis, type RedisOptions } from 'ioredis';
import {
  bucketCapacity,
  describeBucket,
  Limiter,
  LimiterFactory,
  RateLimiter,
  RateLimitOptions,
  RateLimitResult,
  UNLIMITED,
} from './rate-limit.js';

/**
 * The token bucket of rate-limit.ts, kept in Redis so that every worker counts into the same one. One script does the refill, the
 * check and the spend, so two workers can not both spend the last token. Redis forgets a bucket when it has refilled completely
 * (the same as no bucket), so nothing has to clean up after it.
 *
 * KEYS[1] the bucket, ARGV: now (ms), capacity, refill per ms, spend (1 or 0), time to live (ms). Returns {allowed, tokens left}.
 * The numbers go through strings, a Lua number loses its fraction on the way out.
 */
const TAKE_TOKEN = `
local capacity = tonumber(ARGV[2])
local refill = tonumber(ARGV[3])
local now = tonumber(ARGV[1])
local bucket = redis.call('HMGET', KEYS[1], 'tokens', 'at')
local tokens = tonumber(bucket[1])
local at = tonumber(bucket[2])
if tokens == nil then
  tokens = capacity
  at = now
end
tokens = math.min(capacity, tokens + math.max(0, now - at) * refill)
local allowed = 0
if tokens >= 1 then
  allowed = 1
end
if ARGV[4] == '1' then
  if allowed == 1 then
    tokens = tokens - 1
  end
  redis.call('HSET', KEYS[1], 'tokens', tostring(tokens), 'at', tostring(now))
  redis.call('PEXPIRE', KEYS[1], ARGV[5])
end
return {allowed, tostring(tokens)}
`;

/**
 * What the limiter needs of the connection, so a test can stand in for it
 */
export interface TokenBucketClient {
  takeToken(key: string, now: number, capacity: number, refillPerMs: number, spend: 0 | 1, ttlMs: number): Promise<[number, string]>;
}

/** How often a problem with Redis is logged, it would otherwise be one line for every request */
const LOG_INTERVAL_MS = 60_000;

export interface RedisConnection {
  client: TokenBucketClient;
  redis: Redis;
  /** Resolves when the connection is up. Requests do not wait for it, until then the limits are counted per worker. */
  ready: Promise<void>;
}

/** The settings of the connection that env.ts reads */
export interface RedisEnv {
  REDIS_URL?: string | undefined;
  REDIS_HOST?: string | undefined;
  REDIS_PORT: number;
  REDIS_USERNAME?: string | undefined;
  REDIS_PASSWORD?: string | undefined;
  REDIS_DB: number;
  REDIS_TLS: boolean;
}

/**
 * Where to connect, from the environment: a URL, or the settings one by one. Null when nothing asks for Redis.
 */
export const redisTargetFromEnv = (env: RedisEnv): string | RedisOptions | null => {
  if (env.REDIS_URL) return env.REDIS_URL;
  if (!env.REDIS_HOST) return null;

  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    db: env.REDIS_DB,
    ...(env.REDIS_USERNAME ? { username: env.REDIS_USERNAME } : {}),
    ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}),
    ...(env.REDIS_TLS ? { tls: {} } : {}),
  };
};

const CONNECTION_OPTIONS: RedisOptions = {
  connectionName: 'hammertime-api',
  // A request must not wait for Redis, the limiter falls back to counting in memory instead
  commandTimeout: 150,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy: attempt => Math.min(attempt * 250, 5_000),
};

export const connectToRedis = (target: string | RedisOptions, log: (message: string) => void = () => undefined): RedisConnection => {
  const redis = typeof target === 'string' ? new Redis(target, CONNECTION_OPTIONS) : new Redis({ ...CONNECTION_OPTIONS, ...target });
  let lastLoggedAt = 0;
  // Without a listener an error event would be thrown
  redis.on('error', (error: Error) => {
    if (Date.now() - lastLoggedAt >= LOG_INTERVAL_MS) {
      lastLoggedAt = Date.now();
      log(`Redis: ${error.message}`);
    }
  });
  redis.defineCommand('takeToken', { numberOfKeys: 1, lua: TAKE_TOKEN });
  const ready = new Promise<void>(resolve => redis.once('ready', () => resolve()));

  return { redis, client: redis as unknown as TokenBucketClient, ready };
};

export interface RedisRateLimiterOptions extends RateLimitOptions {
  /** Tells apart the kinds of limits that share a Redis, and goes in the key */
  name: string;
  client: TokenBucketClient;
  keyPrefix: string;
  log?: (message: string) => void;
}

/**
 * A rate limiter that counts in Redis, for every worker at once. When Redis can not be reached it counts in memory, per
 * worker, as it did before there was Redis: a limit that is a little looser is better than an API that is down because its
 * rate limiter is.
 */
export class RedisRateLimiter implements Limiter {
  readonly enabled: boolean;
  readonly limit: number;
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly fallback: RateLimiter;
  private lastLoggedAt = 0;

  constructor(private readonly options: RedisRateLimiterOptions) {
    const { perMinute, now = Date.now } = options;
    this.enabled = perMinute > 0;
    this.limit = perMinute;
    this.capacity = bucketCapacity(options);
    this.refillPerMs = perMinute / 60_000;
    // Long enough for the bucket to be full again, which is when forgetting it changes nothing
    this.ttlMs = this.enabled ? Math.ceil(this.capacity / this.refillPerMs) + 1_000 : 0;
    this.now = now;
    this.fallback = new RateLimiter(options);
  }

  consume(id: string): Promise<RateLimitResult> {
    return this.take(id, true);
  }

  peek(id: string): Promise<RateLimitResult> {
    return this.take(id, false);
  }

  private async take(id: string, spend: boolean): Promise<RateLimitResult> {
    if (!this.enabled) {
      return UNLIMITED;
    }

    try {
      const [allowed, tokens] = await this.options.client.takeToken(
        `${this.options.keyPrefix}${this.options.name}:${id}`,
        this.now(),
        this.capacity,
        this.refillPerMs,
        spend ? 1 : 0,
        this.ttlMs,
      );

      return describeBucket(Number(tokens), allowed === 1, { limit: this.limit, capacity: this.capacity, refillPerMs: this.refillPerMs });
    } catch (error) {
      this.warn(error);

      return spend ? this.fallback.consume(id) : this.fallback.peek(id);
    }
  }

  private warn(error: unknown): void {
    if (Date.now() - this.lastLoggedAt < LOG_INTERVAL_MS) return;
    this.lastLoggedAt = Date.now();
    this.options.log?.(`The ${this.options.name} limit is counted per worker for now, Redis did not answer: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export const redisLimiterFactory = (client: TokenBucketClient, { keyPrefix, log }: { keyPrefix: string; log?: (message: string) => void }): LimiterFactory => (
  (name, options) => new RedisRateLimiter({ ...options, name, client, keyPrefix, log })
);
