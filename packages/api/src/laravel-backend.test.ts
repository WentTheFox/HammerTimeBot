import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { BackendError } from './backend.js';
import { LaravelBackend } from './laravel-backend.js';

const reply = (status: number, body?: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const setup = (respond: (url: string, init: RequestInit) => Response | Promise<Response>) => {
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => respond(String(url), init ?? {}));
  const backend = new LaravelBackend({ baseUrl: 'https://laravel.test/', secret: 'internal-secret-123', fetch: fetchMock as unknown as typeof fetch });
  return { backend, fetchMock };
};

const settings = {
  ephemeral: true, timezone: 'GMT', header: true, boldPreview: true, columns: null, format: null,
  formatMinimalReply: true, telemetry: true, defaultAtHour: null, defaultAt12Hour: null, defaultAtMinute: null, defaultAtSecond: 0,
};

describe('LaravelBackend', () => {
  it('sends the shared secret to the internal endpoints', async () => {
    const { backend, fetchMock } = setup(() => reply(200, settings));
    await backend.getSettings('123');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://laravel.test/internal/settings/123');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer internal-secret-123');
  });

  describe('validateKey', () => {
    it('maps the response', async () => {
      const { backend, fetchMock } = setup(() => reply(200, { kind: 'user', discord_user_id: '1', scopes: ['settings:read'], key_id: 'k1' }));
      expect(await backend.validateKey('tok')).toEqual({ kind: 'user', discordUserId: '1', scopes: ['settings:read'], keyId: 'k1' });
      expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({ token: 'tok' });
    });

    it('returns null for an unknown key', async () => {
      expect(await setup(() => reply(401, { message: 'Unauthenticated.' })).backend.validateKey('x')).toBeNull();
    });

    it('rejects a response of the wrong shape', async () => {
      await expect(setup(() => reply(200, { kind: 'wizard' })).backend.validateKey('x')).rejects.toMatchObject({ status: 502 });
    });
  });

  describe('settings', () => {
    it('reads and validates them', async () => {
      expect(await setup(() => reply(200, settings)).backend.getSettings('1')).toEqual(settings);
      await expect(setup(() => reply(200, { ...settings, columns: 'sideways' })).backend.getSettings('1')).rejects.toMatchObject({ status: 502 });
    });

    it('sends the patch as a PATCH and returns the result', async () => {
      const { backend, fetchMock } = setup(() => reply(200, { ...settings, timezone: 'GMT+2' }));
      expect((await backend.updateSettings('1', { timezone: 'GMT+2' })).timezone).toBe('GMT+2');
      const [, init] = fetchMock.mock.calls[0];
      expect(init?.method).toBe('PATCH');
      expect(JSON.parse(init?.body as string)).toEqual({ timezone: 'GMT+2' });
    });

    it('turns Laravel validation errors into a 400 with the issues', async () => {
      const { backend } = setup(() => reply(422, { message: 'The given data was invalid.', errors: { timezone: ['The timezone is not valid.'] } }));
      await expect(backend.updateSettings('1', { timezone: 'Nowhere' })).rejects.toMatchObject({
        status: 400,
        details: [{ path: 'timezone', message: 'The timezone is not valid.' }],
      });
    });
  });

  describe('failures', () => {
    it('passes the read-only window on with its Retry-After', async () => {
      const { backend } = setup(() => reply(503, { message: 'read-only' }, { 'Retry-After': '9' }));
      await expect(backend.getSettings('1')).rejects.toMatchObject({ status: 503, retryAfter: 9 });
      await expect(setup(() => reply(503)).backend.getSettings('1')).rejects.toMatchObject({ status: 503, retryAfter: 5 });
    });

    it('reports an unreachable backend as a bad gateway', async () => {
      const backend = new LaravelBackend({ baseUrl: 'https://laravel.test', secret: 'internal-secret-123', fetch: (() => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch });
      await expect(backend.getSettings('1')).rejects.toMatchObject({ status: 502 });
    });

    it('reports unexpected statuses as a bad gateway', async () => {
      await expect(setup(() => reply(500)).backend.getSettings('1')).rejects.toBeInstanceOf(BackendError);
      await expect(setup(() => reply(500)).backend.getSettings('1')).rejects.toMatchObject({ status: 502 });
    });
  });

  describe('recordTelemetry', () => {
    const request = { commandName: 'at', locale: 'en-US', source: 'api', options: [{ name: 'hour', type: 3 }] } as const;

    it('returns the execution details', async () => {
      const body = { executionNumber: 4, privacyPolicyUrl: 'https://x/legal', commandName: 'at', commandId: '9' };
      const { backend, fetchMock } = setup(() => reply(200, body));
      expect(await backend.recordTelemetry(request)).toEqual(body);
      expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual(request);
    });

    it('gives up quietly while the backend is read-only', async () => {
      expect(await setup(() => reply(503)).backend.recordTelemetry(request)).toBeNull();
    });
  });

  it('shows validation issues from Laravel in the API response', async () => {
    const { backend } = setup((url) => {
      if (url.endsWith('/internal/keys/validate')) return reply(200, { kind: 'user', discord_user_id: '1', scopes: ['settings:write'], key_id: 'k' });
      return reply(422, { message: 'The given data was invalid.', errors: { timezone: ['The timezone is not valid.'] } });
    });
    const response = await createApp({ backend }).request('/settings', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: 'Nowhere' }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'invalid_request', message: 'The given data was invalid.', issues: [{ path: 'timezone', message: 'The timezone is not valid.' }] },
    });
  });
});
