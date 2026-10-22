import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

describe('loadEnv', () => {
  const valid = { LARAVEL_URL: 'https://hammertime.cyou', INTERNAL_API_SECRET: 'a-long-enough-secret' };

  it('applies the defaults', () => {
    expect(loadEnv(valid)).toEqual({
      ...valid,
      HOST: '127.0.0.1',
      PORT: 3010,
      KEY_CACHE_TTL_SECONDS: 30,
      RATE_LIMIT_PER_MINUTE: 60,
      RATE_LIMIT_BURST: undefined,
      AUTH_FAILURES_PER_MINUTE: 20,
      CLIENT_IP_HEADER: undefined,
    });
  });

  it('reads the rate limits', () => {
    expect(loadEnv({ ...valid, RATE_LIMIT_PER_MINUTE: '120', RATE_LIMIT_BURST: '10', AUTH_FAILURES_PER_MINUTE: '5', CLIENT_IP_HEADER: 'X-Real-IP' }))
      .toMatchObject({ RATE_LIMIT_PER_MINUTE: 120, RATE_LIMIT_BURST: 10, AUTH_FAILURES_PER_MINUTE: 5, CLIENT_IP_HEADER: 'X-Real-IP' });
  });

  it('can turn the rate limits off, and treats an empty client address header as not set', () => {
    expect(loadEnv({ ...valid, RATE_LIMIT_PER_MINUTE: '0', AUTH_FAILURES_PER_MINUTE: '0', CLIENT_IP_HEADER: '' }))
      .toMatchObject({ RATE_LIMIT_PER_MINUTE: 0, AUTH_FAILURES_PER_MINUTE: 0, CLIENT_IP_HEADER: undefined });
  });

  it('rejects a burst that is not at least one', () => {
    expect(() => loadEnv({ ...valid, RATE_LIMIT_BURST: '0' })).toThrow(/RATE_LIMIT_BURST/);
  });

  it('can turn the key cache off', () => {
    expect(loadEnv({ ...valid, KEY_CACHE_TTL_SECONDS: '0' }).KEY_CACHE_TTL_SECONDS).toBe(0);
  });

  it('reads the port as a number', () => {
    expect(loadEnv({ ...valid, PORT: '8080' }).PORT).toBe(8080);
  });

  it('names what is wrong', () => {
    expect(() => loadEnv({})).toThrow(/LARAVEL_URL/);
    expect(() => loadEnv({ ...valid, INTERNAL_API_SECRET: 'short' })).toThrow(/INTERNAL_API_SECRET/);
    expect(() => loadEnv({ ...valid, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => loadEnv({ ...valid, KEY_CACHE_TTL_SECONDS: '3600' })).toThrow(/KEY_CACHE_TTL_SECONDS/);
  });
});
