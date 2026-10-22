import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { createRateLimits, RateLimitConfig } from './rate-limit.js';
import { DISCORD_USER_ID, FakeBackend, SERVICE_TOKEN, USER_TOKEN } from './testing/fake-backend.js';

const clock = { now: Date.parse('2022-04-24T12:22:33.000Z') };

class CountingBackend extends FakeBackend {
  validations = 0;

  async validateKey(token: string) {
    this.validations += 1;
    return super.validateKey(token);
  }
}

let backend: CountingBackend;

/** 6 requests a minute with a burst of 3 is one request every 10 seconds, and 4 failed attempts per address */
const setup = (config: RateLimitConfig = {}) => {
  backend = new CountingBackend();
  const now = () => clock.now;
  const limits = createRateLimits({ requestsPerMinute: 6, requestsBurst: 3, authFailuresPerMinute: 4, now, ...config });
  return createApp({ backend, now, telemetryTimeoutMs: 50, limits });
};

const get = (app: ReturnType<typeof setup>, path: string, token: string | null = USER_TOKEN, headers: Record<string, string> = {}) =>
  app.request(path, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers } });

const post = (app: ReturnType<typeof setup>, path: string, token: string, body: unknown = { value: 0 }, headers: Record<string, string> = {}) =>
  app.request(path, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

beforeEach(() => {
  clock.now = Date.parse('2022-04-24T12:22:33.000Z');
});

describe('requests per key', () => {
  it('tells every response how much is left', async () => {
    const app = setup();

    const first = await get(app, '/me');
    const second = await get(app, '/me');

    expect(first.headers.get('RateLimit-Limit')).toBe('6');
    expect(first.headers.get('RateLimit-Remaining')).toBe('2');
    expect(second.headers.get('RateLimit-Remaining')).toBe('1');
    expect(first.headers.get('Retry-After')).toBeNull();
  });

  it('refuses once the burst is used, saying when to come back', async () => {
    const app = setup();
    for (let i = 0; i < 3; i++) {
      expect((await get(app, '/me')).status).toBe(200);
    }

    const refused = await get(app, '/me');

    expect(refused.status).toBe(429);
    expect(refused.headers.get('Retry-After')).toBe('10');
    expect(refused.headers.get('RateLimit-Remaining')).toBe('0');
    expect(await refused.json()).toEqual({ error: { code: 'rate_limited', message: 'Too many requests, slow down' } });
  });

  it('lets requests through again as time passes', async () => {
    const app = setup();
    for (let i = 0; i < 4; i++) await get(app, '/me');

    clock.now += 9_000;
    expect((await get(app, '/me')).status).toBe(429);
    clock.now += 1_000;
    expect((await get(app, '/me')).status).toBe(200);
  });

  it('counts every endpoint and the bots commands towards the same key', async () => {
    const app = setup();

    expect((await post(app, '/unix', USER_TOKEN)).status).toBe(200);
    expect((await get(app, '/settings')).status).toBe(200);
    expect((await get(app, '/me')).status).toBe(200);
    expect((await post(app, '/unix', USER_TOKEN)).status).toBe(429);
  });

  it('counts a request that is refused for lacking the scope', async () => {
    const app = setup();
    backend.keys.set('read-only', { kind: 'user', discordUserId: DISCORD_USER_ID, scopes: ['settings:read'], keyId: 'ro' });

    expect((await post(app, '/unix', 'read-only')).status).toBe(403);
    expect((await post(app, '/unix', 'read-only')).status).toBe(403);
    expect((await post(app, '/unix', 'read-only')).status).toBe(403);
    expect((await post(app, '/unix', 'read-only')).status).toBe(429);
  });

  it('limits each key on its own', async () => {
    const app = setup();
    backend.keys.set('second', { kind: 'user', discordUserId: DISCORD_USER_ID, scopes: ['settings:read'], keyId: 'k2' });
    for (let i = 0; i < 4; i++) await get(app, '/me');

    expect((await get(app, '/me')).status).toBe(429);
    expect((await get(app, '/me', 'second')).status).toBe(200);
  });

  it('does not limit the health check or the documentation', async () => {
    const app = setup();

    for (let i = 0; i < 20; i++) {
      expect((await get(app, '/health', null)).status).toBe(200);
      expect((await get(app, '/generated/api-docs.json', null)).status).toBe(200);
    }
  });

  it('is off when set to 0', async () => {
    const app = setup({ requestsPerMinute: 0 });

    for (let i = 0; i < 50; i++) {
      const response = await get(app, '/me');
      expect(response.status).toBe(200);
      expect(response.headers.get('RateLimit-Limit')).toBeNull();
    }
  });
});

describe("the bot's service key", () => {
  const asAccount = (id: string) => ({ 'X-Discord-User-Id': id });

  it('is limited per Discord account, so one user cannot use up what the others get', async () => {
    const app = setup();
    for (let i = 0; i < 3; i++) {
      expect((await post(app, '/unix', SERVICE_TOKEN, { value: 0 }, asAccount('111111111111111111'))).status).toBe(200);
    }

    expect((await post(app, '/unix', SERVICE_TOKEN, { value: 0 }, asAccount('111111111111111111'))).status).toBe(429);
    expect((await post(app, '/unix', SERVICE_TOKEN, { value: 0 }, asAccount('222222222222222222'))).status).toBe(200);
  });

  it('does not share a limit with the keys of that account', async () => {
    const app = setup();
    for (let i = 0; i < 3; i++) await post(app, '/unix', SERVICE_TOKEN, { value: 0 }, asAccount(DISCORD_USER_ID));

    expect((await post(app, '/unix', SERVICE_TOKEN, { value: 0 }, asAccount(DISCORD_USER_ID))).status).toBe(429);
    expect((await get(app, '/me')).status).toBe(200);
  });
});

describe('failed authentication', () => {
  const fail = (app: ReturnType<typeof setup>, headers: Record<string, string> = {}) => get(app, '/me', 'made-up-key', headers);

  it('turns an address away after too many failures, without asking the backend', async () => {
    const app = setup();
    for (let i = 0; i < 4; i++) {
      expect((await fail(app)).status).toBe(401);
    }
    const validationsBefore = backend.validations;

    const locked = await fail(app);

    expect(locked.status).toBe(429);
    expect((await locked.json()).error.message).toContain('failed attempts');
    expect(locked.headers.get('Retry-After')).toBe('15');
    expect(locked.headers.get('RateLimit-Limit')).toBeNull();
    // Even a good key from that address waits, and none of it reaches the backend
    expect((await get(app, '/me')).status).toBe(429);
    expect(backend.validations).toBe(validationsBefore);
  });

  it('lets the address back in as time passes', async () => {
    const app = setup();
    for (let i = 0; i < 5; i++) await fail(app);

    clock.now += 15_000;

    expect((await get(app, '/me')).status).toBe(200);
  });

  it('does not count good requests, or requests that are only refused for another reason', async () => {
    const app = setup({ requestsPerMinute: 0 });
    backend.keys.set('read-only', { kind: 'user', discordUserId: DISCORD_USER_ID, scopes: ['settings:read'], keyId: 'ro' });

    for (let i = 0; i < 10; i++) {
      expect((await get(app, '/me')).status).toBe(200);
      expect((await post(app, '/unix', 'read-only')).status).toBe(403);
    }
    expect((await fail(app)).status).toBe(401);
  });

  it('counts each address on its own when the proxy names the client in a header', async () => {
    const app = setup({ clientIpHeader: 'X-Real-IP' });
    for (let i = 0; i < 5; i++) await fail(app, { 'X-Real-IP': '203.0.113.1' });

    expect((await fail(app, { 'X-Real-IP': '203.0.113.1' })).status).toBe(429);
    expect((await fail(app, { 'X-Real-IP': '203.0.113.2' })).status).toBe(401);
  });

  it('ignores a header nobody vouched for, so it cannot be used to pick the address', async () => {
    const app = setup();
    for (let i = 0; i < 5; i++) await fail(app, { 'X-Real-IP': `203.0.113.${i}` });

    expect((await fail(app, { 'X-Real-IP': '203.0.113.99' })).status).toBe(429);
  });

  it('is off when set to 0', async () => {
    const app = setup({ authFailuresPerMinute: 0 });

    for (let i = 0; i < 30; i++) {
      expect((await fail(app)).status).toBe(401);
    }
  });
});

describe('the MCP endpoint', () => {
  const list = (app: ReturnType<typeof setup>, token = USER_TOKEN) => app.request('/mcp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });

  it('is limited per key, and tells the client how much is left', async () => {
    const app = setup();

    const first = await list(app);
    expect(first.status).toBe(200);
    expect(first.headers.get('RateLimit-Remaining')).toBe('2');
    await list(app);
    await list(app);

    const refused = await list(app);
    expect(refused.status).toBe(429);
    expect(refused.headers.get('Retry-After')).toBe('10');
  });

  it('shares the limit of the key with the REST endpoints', async () => {
    const app = setup();
    await get(app, '/me');
    await get(app, '/me');
    await list(app);

    expect((await get(app, '/me')).status).toBe(429);
  });

  it('turns an address away after too many failures', async () => {
    const app = setup();
    for (let i = 0; i < 4; i++) {
      expect((await list(app, 'made-up-key')).status).toBe(401);
    }

    expect((await list(app, 'made-up-key')).status).toBe(429);
  });
});
