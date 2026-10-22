import { describe, expect, it } from 'vitest';
import { createRateLimits, RateLimiter, rateLimitHeaders } from './rate-limit.js';

const clock = (start = 1_000_000) => {
  const state = { now: start };
  return { state, now: () => state.now };
};

describe('RateLimiter', () => {
  it('allows a burst, then refuses until tokens come back', () => {
    const { state, now } = clock();
    const limiter = new RateLimiter({ perMinute: 6, burst: 3, now });

    expect([1, 2, 3].map(() => limiter.consume('a').allowed)).toEqual([true, true, true]);
    const refused = limiter.consume('a');

    expect(refused).toMatchObject({ allowed: false, remaining: 0, limit: 6 });
    expect(refused.retryAfterSeconds).toBe(10);

    state.now += 10_000;
    expect(limiter.consume('a').allowed).toBe(true);
    expect(limiter.consume('a').allowed).toBe(false);
  });

  it('counts down what is left and when the bucket is full again', () => {
    const { now } = clock();
    const limiter = new RateLimiter({ perMinute: 60, burst: 10, now });

    expect(limiter.consume('a')).toMatchObject({ allowed: true, remaining: 9, resetSeconds: 1 });
    expect(limiter.consume('a')).toMatchObject({ remaining: 8, resetSeconds: 2 });
  });

  it('never collects more than the burst, however long it was idle', () => {
    const { state, now } = clock();
    const limiter = new RateLimiter({ perMinute: 60, burst: 2, now });

    state.now += 3_600_000;

    expect(limiter.consume('a').remaining).toBe(1);
    expect(limiter.consume('a').remaining).toBe(0);
    expect(limiter.consume('a').allowed).toBe(false);
  });

  it('defaults the burst to half a minute of requests', () => {
    const { now } = clock();
    const limiter = new RateLimiter({ perMinute: 60, now });

    expect(limiter.consume('a').remaining).toBe(29);
  });

  it('keeps identities apart', () => {
    const { now } = clock();
    const limiter = new RateLimiter({ perMinute: 6, burst: 1, now });

    expect(limiter.consume('a').allowed).toBe(true);
    expect(limiter.consume('a').allowed).toBe(false);
    expect(limiter.consume('b').allowed).toBe(true);
  });

  it('can look without spending', () => {
    const { now } = clock();
    const limiter = new RateLimiter({ perMinute: 6, burst: 1, now });

    expect(limiter.peek('a').allowed).toBe(true);
    expect(limiter.peek('a').allowed).toBe(true);
    limiter.consume('a');
    expect(limiter.peek('a').allowed).toBe(false);
  });

  it('is off with 0 per minute', () => {
    const limiter = new RateLimiter({ perMinute: 0 });

    for (let i = 0; i < 1000; i++) {
      expect(limiter.consume('a').allowed).toBe(true);
    }
    expect(limiter.enabled).toBe(false);
  });

  it('drops the least recently used buckets when it is full', () => {
    const { now } = clock();
    const limiter = new RateLimiter({ perMinute: 6, burst: 1, maxEntries: 2, now });
    limiter.consume('a');
    limiter.consume('b');
    limiter.consume('c');

    // 'a' was dropped, so it starts over with a full bucket, while 'c' is still empty
    expect(limiter.consume('a').allowed).toBe(true);
    expect(limiter.consume('c').allowed).toBe(false);
  });
});

describe('rateLimitHeaders', () => {
  const { now } = clock();

  it('describes the limit, and adds Retry-After only when refusing', () => {
    const limiter = new RateLimiter({ perMinute: 6, burst: 1, now });

    expect(rateLimitHeaders(limiter.consume('a'))).toEqual({ 'RateLimit-Limit': '6', 'RateLimit-Remaining': '0', 'RateLimit-Reset': '10' });
    expect(rateLimitHeaders(limiter.consume('a'))).toEqual({
      'RateLimit-Limit': '6',
      'RateLimit-Remaining': '0',
      'RateLimit-Reset': '10',
      'Retry-After': '10',
    });
  });

  it('has nothing to say when there is no limit', () => {
    expect(rateLimitHeaders(new RateLimiter({ perMinute: 0 }).consume('a'))).toEqual({});
  });
});

describe('the client address', () => {
  const request = (headers: Record<string, string>) => new Request('http://api.test/at', { headers });

  it('is the address of the connection unless a header is trusted', () => {
    const { clientIp } = createRateLimits();

    expect(clientIp(request({ 'X-Real-IP': '203.0.113.9' }), '10.0.0.1')).toBe('10.0.0.1');
    expect(clientIp(request({}), undefined)).toBe('unknown');
  });

  it('comes from the header the operator named, the first entry of a list', () => {
    const { clientIp } = createRateLimits({ clientIpHeader: 'X-Forwarded-For' });

    expect(clientIp(request({ 'X-Forwarded-For': '203.0.113.9, 10.0.0.2' }), '10.0.0.1')).toBe('203.0.113.9');
    expect(clientIp(request({}), '10.0.0.1')).toBe('10.0.0.1');
  });
});
