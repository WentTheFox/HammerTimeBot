import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { connectToRedis, redisTargetFromEnv, RedisRateLimiter, TokenBucketClient } from './redis-rate-limit.js';

const standIn = (answer: () => Promise<[number, string]>): TokenBucketClient & { takeToken: ReturnType<typeof vi.fn> } => ({
  takeToken: vi.fn(answer),
});

describe('RedisRateLimiter with a stand-in for Redis', () => {
  it('describes the answer of Redis the way the in-memory limiter describes its own', async () => {
    const client = standIn(async () => [1, '9.5']);
    const limiter = new RedisRateLimiter({ name: 'requests', client, keyPrefix: 'p:', perMinute: 60, burst: 10 });

    expect(await limiter.consume('key:1')).toEqual({ allowed: true, limit: 60, remaining: 9, resetSeconds: 1, retryAfterSeconds: 0 });
  });

  it('asks Redis with a key of its own, and the shape of the bucket', async () => {
    const client = standIn(async () => [1, '9']);
    const limiter = new RedisRateLimiter({ name: 'auth-failures', client, keyPrefix: 'hammertime-api:', perMinute: 60, burst: 10, now: () => 1234 });

    await limiter.consume('203.0.113.9');
    await limiter.peek('203.0.113.9');

    expect(client.takeToken).toHaveBeenNthCalledWith(1, 'hammertime-api:auth-failures:203.0.113.9', 1234, 10, 60 / 60_000, 1, 11_000);
    // Looking at it does not spend a token
    expect(client.takeToken).toHaveBeenNthCalledWith(2, 'hammertime-api:auth-failures:203.0.113.9', 1234, 10, 60 / 60_000, 0, 11_000);
  });

  it('refuses when Redis says the bucket was empty, and says when to come back', async () => {
    const limiter = new RedisRateLimiter({ name: 'requests', client: standIn(async () => [0, '0.5']), keyPrefix: 'p:', perMinute: 60, burst: 10 });

    expect(await limiter.consume('a')).toMatchObject({ allowed: false, remaining: 0, retryAfterSeconds: 1 });
  });

  it('counts in memory when Redis does not answer, and says so only once in a while', async () => {
    const log = vi.fn();
    const limiter = new RedisRateLimiter({
      name: 'requests',
      client: standIn(() => Promise.reject(new Error('Connection is closed'))),
      keyPrefix: 'p:',
      perMinute: 6,
      burst: 2,
      log,
    });

    const results = [await limiter.consume('b'), await limiter.consume('b'), await limiter.consume('b')];

    expect(results.map(result => result.allowed)).toEqual([true, true, false]);
    // Looking is possible without Redis too
    expect((await limiter.peek('c')).allowed).toBe(true);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Connection is closed'));
  });

  it('does not ask Redis at all when the limit is off', async () => {
    const client = standIn(async () => [1, '1']);
    const limiter = new RedisRateLimiter({ name: 'requests', client, keyPrefix: 'p:', perMinute: 0 });

    expect(await limiter.consume('a')).toMatchObject({ allowed: true, limit: 0 });
    expect(client.takeToken).not.toHaveBeenCalled();
  });
});

describe('redisTargetFromEnv', () => {
  const defaults = { REDIS_PORT: 6379, REDIS_DB: 0, REDIS_TLS: false };

  it('is nothing without a URL or a host, which leaves the limits per worker', () => {
    expect(redisTargetFromEnv(defaults)).toBeNull();
    expect(redisTargetFromEnv({ ...defaults, REDIS_PASSWORD: 'unused without a host', REDIS_DB: 3 })).toBeNull();
  });

  it('is the URL when there is one, ahead of the separate settings', () => {
    expect(redisTargetFromEnv({ ...defaults, REDIS_URL: 'redis://127.0.0.1:6379/2', REDIS_HOST: 'other' })).toBe('redis://127.0.0.1:6379/2');
  });

  it('is built from the settings one by one, with only what is set', () => {
    expect(redisTargetFromEnv({ ...defaults, REDIS_HOST: '127.0.0.1', REDIS_DB: 2 })).toEqual({ host: '127.0.0.1', port: 6379, db: 2 });
    expect(redisTargetFromEnv({ ...defaults, REDIS_HOST: 'redis.internal', REDIS_PORT: 6380, REDIS_USERNAME: 'api', REDIS_PASSWORD: 'p@ss:word/1', REDIS_TLS: true }))
      .toEqual({ host: 'redis.internal', port: 6380, db: 0, username: 'api', password: 'p@ss:word/1', tls: {} });
  });
});

// The script is what has to be right, and only Redis can say that. Set TEST_REDIS_URL to run these (CI does), they use the
// database it names, with keys of their own that they remove again.
const url = process.env.TEST_REDIS_URL;

describe.skipIf(!url)('RedisRateLimiter against a real Redis', () => {
  const prefix = `test-${randomUUID()}:`;
  let connection: ReturnType<typeof connectToRedis>;
  let raw: Redis;

  beforeAll(async () => {
    connection = connectToRedis(url as string);
    raw = connection.redis;
    // A command before the connection is up is refused (the limiter would count in memory), which is not what is tested here
    await connection.ready;
  });

  afterAll(async () => {
    const keys = await raw.keys(`${prefix}*`);
    if (keys.length > 0) await raw.del(...keys);
    raw.disconnect();
  });

  const worker = (name: string, options: { perMinute: number; burst?: number; now?: () => number }) => new RedisRateLimiter({
    name,
    client: connection.client,
    keyPrefix: prefix,
    ...options,
  });

  it('is one limit for every worker, which is the point of it', async () => {
    const [first, second] = [worker('shared', { perMinute: 6, burst: 3 }), worker('shared', { perMinute: 6, burst: 3 })];

    const results = [await first.consume('k'), await second.consume('k'), await first.consume('k'), await second.consume('k')];

    // A burst of 3 in total, not 3 each
    expect(results.map(result => result.allowed)).toEqual([true, true, true, false]);
  });

  it('never lets two workers spend the last token at the same moment', async () => {
    const limiters = Array.from({ length: 4 }, () => worker('race', { perMinute: 6, burst: 5 }));

    const results = await Promise.all(Array.from({ length: 40 }, (_, i) => limiters[i % limiters.length].consume('k')));

    expect(results.filter(result => result.allowed)).toHaveLength(5);
  });

  it('refills over time, in the clock it is given', async () => {
    let now = 1_000_000;
    const limiter = worker('refill', { perMinute: 6, burst: 1, now: () => now });

    expect((await limiter.consume('k')).allowed).toBe(true);
    expect(await limiter.consume('k')).toMatchObject({ allowed: false, retryAfterSeconds: 10 });
    now += 10_000;
    expect((await limiter.consume('k')).allowed).toBe(true);
  });

  it('keeps identities and kinds of limits apart', async () => {
    const requests = worker('requests-a', { perMinute: 6, burst: 1 });
    const other = worker('other-a', { perMinute: 6, burst: 1 });

    await requests.consume('k');

    expect((await requests.consume('l')).allowed).toBe(true);
    expect((await other.consume('k')).allowed).toBe(true);
    expect((await requests.consume('k')).allowed).toBe(false);
  });

  it('only looks when asked to peek', async () => {
    const limiter = worker('peek', { perMinute: 6, burst: 1 });

    expect((await limiter.peek('k')).allowed).toBe(true);
    expect((await limiter.peek('k')).allowed).toBe(true);
    await limiter.consume('k');
    expect((await limiter.peek('k')).allowed).toBe(false);
  });

  it('answers like the in-memory limiter, so the headers do not depend on which one counts', async () => {
    const limiter = worker('headers', { perMinute: 60, burst: 10, now: () => 5_000_000 });

    expect(await limiter.consume('k')).toEqual({ allowed: true, limit: 60, remaining: 9, resetSeconds: 1, retryAfterSeconds: 0 });
    expect(await limiter.consume('k')).toMatchObject({ remaining: 8, resetSeconds: 2 });
  });

  it('lets Redis forget a bucket once it would be full again, so nothing needs cleaning up', async () => {
    const limiter = worker('expiry', { perMinute: 6, burst: 1 });

    await limiter.consume('k');

    const ttl = await raw.pttl(`${prefix}expiry:k`);
    // 10 s for the one token to come back, and a second to spare
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(11_000);
  });

  it('counts per worker, as before, while Redis is not there', async () => {
    const down = new RedisRateLimiter({
      name: 'down',
      client: { takeToken: () => Promise.reject(new Error('ECONNREFUSED')) },
      keyPrefix: prefix,
      perMinute: 6,
      burst: 1,
    });

    expect([(await down.consume('k')).allowed, (await down.consume('k')).allowed]).toEqual([true, false]);
  });
});
