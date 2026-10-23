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
      REDIS_URL: undefined,
      REDIS_HOST: undefined,
      REDIS_PORT: 6379,
      REDIS_USERNAME: undefined,
      REDIS_PASSWORD: undefined,
      REDIS_DB: 0,
      REDIS_TLS: false,
      REDIS_KEY_PREFIX: 'hammertime-api:',
    });
  });

  it('reads the Redis settings, and treats empty ones as not set', () => {
    expect(loadEnv({ ...valid, REDIS_HOST: '127.0.0.1', REDIS_PORT: '6380', REDIS_DB: '2', REDIS_PASSWORD: 'p@ss:word', REDIS_TLS: '1', REDIS_KEY_PREFIX: 'x:' }))
      .toMatchObject({ REDIS_HOST: '127.0.0.1', REDIS_PORT: 6380, REDIS_DB: 2, REDIS_PASSWORD: 'p@ss:word', REDIS_TLS: true, REDIS_KEY_PREFIX: 'x:' });
    expect(loadEnv({ ...valid, REDIS_URL: '', REDIS_HOST: '', REDIS_PASSWORD: '', REDIS_USERNAME: '' }))
      .toMatchObject({ REDIS_URL: undefined, REDIS_HOST: undefined, REDIS_PASSWORD: undefined, REDIS_USERNAME: undefined });
  });

  it('names a Redis setting that is wrong', () => {
    expect(() => loadEnv({ ...valid, REDIS_PORT: 'abc' })).toThrow(/REDIS_PORT/);
    expect(() => loadEnv({ ...valid, REDIS_TLS: 'maybe' })).toThrow(/REDIS_TLS/);
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
