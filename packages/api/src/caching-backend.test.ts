import { describe, expect, it, vi } from 'vitest';
import type { Backend, KeyContext } from './backend.js';
import { BackendError } from './backend.js';
import { CachingBackend } from './caching-backend.js';

const key = (keyId: string): KeyContext => ({ kind: 'user', discordUserId: '1', scopes: ['settings:read'], keyId });

/** A backend that counts what it is asked, with a clock the test moves by hand */
const setup = (options: ConstructorParameters<typeof CachingBackend>[1] = {}) => {
  const clock = { now: 1_000_000 };
  const known = new Map<string, KeyContext>([['good', key('k1')], ['other', key('k2')]]);
  const inner = {
    validateKey: vi.fn(async (token: string) => known.get(token) ?? null),
    getSettings: vi.fn(async () => ({ timezone: 'GMT' }) as never),
    updateSettings: vi.fn(async () => ({ timezone: 'GMT+2' }) as never),
    recordTelemetry: vi.fn(async () => null),
  } satisfies Backend;
  const cache = new CachingBackend(inner, { ttlMs: 30_000, negativeTtlMs: 5_000, now: () => clock.now, ...options });

  return { cache, inner, clock, known };
};

describe('CachingBackend', () => {
  it('asks the backend once for a valid key while it is fresh', async () => {
    const { cache, inner, clock } = setup();

    expect(await cache.validateKey('good')).toEqual(key('k1'));
    clock.now += 29_999;
    expect(await cache.validateKey('good')).toEqual(key('k1'));

    expect(inner.validateKey).toHaveBeenCalledTimes(1);
  });

  it('asks again once the entry has expired, and notices a revoked key then', async () => {
    const { cache, inner, clock, known } = setup();
    await cache.validateKey('good');

    known.delete('good');
    clock.now += 30_001;

    expect(await cache.validateKey('good')).toBeNull();
    expect(inner.validateKey).toHaveBeenCalledTimes(2);
  });

  it('keeps trusting a revoked key until its entry expires', async () => {
    const { cache, clock, known } = setup();
    await cache.validateKey('good');

    known.delete('good');
    clock.now += 10_000;

    expect(await cache.validateKey('good')).toEqual(key('k1'));
  });

  it('remembers an unknown key only briefly', async () => {
    const { cache, inner, clock, known } = setup();

    expect(await cache.validateKey('new')).toBeNull();
    expect(await cache.validateKey('new')).toBeNull();
    expect(inner.validateKey).toHaveBeenCalledTimes(1);

    // The key exists a moment later, and is picked up as soon as the short entry is gone
    known.set('new', key('k3'));
    clock.now += 5_001;
    expect(await cache.validateKey('new')).toEqual(key('k3'));
  });

  it('does not remember failures of the backend', async () => {
    const { cache, inner } = setup();
    inner.validateKey.mockRejectedValueOnce(new BackendError(502, 'The backend could not be reached'));

    await expect(cache.validateKey('good')).rejects.toBeInstanceOf(BackendError);
    expect(await cache.validateKey('good')).toEqual(key('k1'));
    expect(inner.validateKey).toHaveBeenCalledTimes(2);
  });

  it('shares one call between concurrent requests with the same key', async () => {
    const { cache, inner } = setup();

    const results = await Promise.all([cache.validateKey('good'), cache.validateKey('good'), cache.validateKey('good')]);

    expect(results).toEqual([key('k1'), key('k1'), key('k1')]);
    expect(inner.validateKey).toHaveBeenCalledTimes(1);
  });

  it('keeps different keys apart', async () => {
    const { cache } = setup();

    expect((await cache.validateKey('good'))?.keyId).toBe('k1');
    expect((await cache.validateKey('other'))?.keyId).toBe('k2');
    expect((await cache.validateKey('good'))?.keyId).toBe('k1');
  });

  it('drops the oldest entries when it is full', async () => {
    const { cache, inner, known } = setup({ maxEntries: 2 });
    known.set('third', key('k3'));
    await cache.validateKey('good');
    await cache.validateKey('other');
    await cache.validateKey('third');
    expect(inner.validateKey).toHaveBeenCalledTimes(3);

    await cache.validateKey('other');
    await cache.validateKey('third');
    expect(inner.validateKey).toHaveBeenCalledTimes(3);
    await cache.validateKey('good');
    expect(inner.validateKey).toHaveBeenCalledTimes(4);
  });

  it('is off with a ttl of 0', async () => {
    const { cache, inner } = setup({ ttlMs: 0 });

    await cache.validateKey('good');
    await cache.validateKey('good');

    expect(inner.validateKey).toHaveBeenCalledTimes(2);
  });

  it('never remembers an unknown key longer than a valid one', async () => {
    const { cache, inner, clock } = setup({ ttlMs: 2_000, negativeTtlMs: 60_000 });

    await cache.validateKey('nobody');
    clock.now += 2_001;
    await cache.validateKey('nobody');

    expect(inner.validateKey).toHaveBeenCalledTimes(2);
  });

  it('passes everything else straight through', async () => {
    const { cache, inner } = setup();

    await cache.getSettings('1');
    await cache.getSettings('1');
    await cache.updateSettings('1', { timezone: 'GMT+2' });
    await cache.recordTelemetry({ commandName: 'at', locale: 'en-US', source: 'api', options: [] });

    expect(inner.getSettings).toHaveBeenCalledTimes(2);
    expect(inner.updateSettings).toHaveBeenCalledWith('1', { timezone: 'GMT+2' });
    expect(inner.recordTelemetry).toHaveBeenCalledTimes(1);
  });
});
