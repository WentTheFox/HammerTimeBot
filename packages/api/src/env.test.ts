import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

describe('loadEnv', () => {
  const valid = { LARAVEL_URL: 'https://hammertime.cyou', INTERNAL_API_SECRET: 'a-long-enough-secret' };

  it('applies the defaults', () => {
    expect(loadEnv(valid)).toEqual({ ...valid, HOST: '127.0.0.1', PORT: 3010 });
  });

  it('reads the port as a number', () => {
    expect(loadEnv({ ...valid, PORT: '8080' }).PORT).toBe(8080);
  });

  it('names what is wrong', () => {
    expect(() => loadEnv({})).toThrow(/LARAVEL_URL/);
    expect(() => loadEnv({ ...valid, INTERNAL_API_SECRET: 'short' })).toThrow(/INTERNAL_API_SECRET/);
    expect(() => loadEnv({ ...valid, PORT: 'abc' })).toThrow(/PORT/);
  });
});
