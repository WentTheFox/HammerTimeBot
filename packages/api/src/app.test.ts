import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { BackendError } from './backend.js';
import { commandNames } from './generated/commands.js';
import { commandResolvers } from './commands.js';
import { DISCORD_USER_ID, FakeBackend, SERVICE_TOKEN, USER_TOKEN } from './testing/fake-backend.js';

const NOW = Date.parse('2022-04-24T12:22:33.000Z');
const unixOf = (iso: string) => Date.parse(iso) / 1000;

let backend: FakeBackend;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  backend = new FakeBackend();
  app = createApp({ backend, now: () => NOW, telemetryTimeoutMs: 50 });
});

interface CallOptions {
  method?: string;
  token?: string | null;
  body?: unknown;
  headers?: Record<string, string>;
}

const call = async (path: string, { method = 'POST', token = USER_TOKEN, body, headers = {} }: CallOptions = {}) => {
  const response = await app.request(path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: response.status, headers: response.headers, json: (await response.json()) as any };
};

describe('the documented permissions', () => {
  it('are what each endpoint enforces', async () => {
    const allScopes = ['timestamps:create', 'settings:read', 'settings:write'];
    const spec = (await call('/generated/api-docs.json', { method: 'GET', token: null })).json;
    let checked = 0;

    for (const [path, operations] of Object.entries<Record<string, { 'x-required-scope'?: string }>>(spec.paths)) {
      for (const [method, operation] of Object.entries(operations)) {
        const scope = operation['x-required-scope'];
        if (!scope) continue;
        const token = `without-${scope}`;
        backend.keys.set(token, { kind: 'user', discordUserId: DISCORD_USER_ID, scopes: allScopes.filter(other => other !== scope), keyId: 'k' });

        const response = await call(path, { method: method.toUpperCase(), token, body: method === 'get' ? undefined : {} });

        expect(response.status, `${method} ${path} without ${scope}`).toBe(403);
        checked++;
      }
    }
    expect(checked).toBe(commandNames.length + 3);
  });
});

describe('authentication', () => {
  it('serves the health check without a key', async () => {
    expect(await call('/health', { method: 'GET', token: null })).toMatchObject({ status: 200, json: { status: 'ok' } });
  });

  it('rejects requests without a key', async () => {
    const response = await call('/at', { body: {}, token: null });
    expect(response.status).toBe(401);
    expect(response.json.error.code).toBe('unauthorized');
    expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
  });

  it('rejects unknown keys', async () => {
    expect((await call('/at', { body: {}, token: 'nope' })).status).toBe(401);
  });

  it('rejects keys without the scope', async () => {
    backend.keys.set('read-only', { kind: 'user', discordUserId: DISCORD_USER_ID, scopes: ['settings:read'], keyId: 'k' });
    const response = await call('/at', { body: {}, token: 'read-only' });
    expect(response.status).toBe(403);
    expect(response.json.error.message).toContain('timestamps:create');
  });

  it('reports the key on /me', async () => {
    expect((await call('/me', { method: 'GET' })).json).toEqual({
      keyId: 'key-1',
      kind: 'user',
      discordUserId: DISCORD_USER_ID,
      scopes: ['timestamps:create', 'settings:read', 'settings:write'],
    });
  });

  describe('service keys', () => {
    it('require the account to act as', async () => {
      const response = await call('/at', { body: {}, token: SERVICE_TOKEN });
      expect(response.status).toBe(400);
      expect(response.json.error.code).toBe('invalid_request');
    });

    it('act as the named account and are recorded as the bot', async () => {
      const response = await call('/at', {
        body: { hour: '15', minute: 5 },
        token: SERVICE_TOKEN,
        headers: { 'X-Discord-User-Id': '999999999999999999' },
      });
      expect(response.status).toBe(200);
      expect(backend.telemetryCalls[0].source).toBe('discord-bot');
    });
  });
});

describe('timestamp endpoints', () => {
  it('builds the time like the at command', async () => {
    const { status, json } = await call('/at', { body: { hour: '9', minute: 0, timezone: 'GMT+2' } });
    expect(status).toBe(200);
    expect(json).toMatchObject({
      command: 'at',
      unix: unixOf('2022-04-24T07:00:00Z'),
      timezone: 'GMT+2',
    });
    expect(json.formats).toHaveLength(9);
    expect(json.formats[0]).toEqual({ format: 'd', timestamp: `<t:${unixOf('2022-04-24T07:00:00Z')}:d>` });
    expect(json.header).toContain('2022-04-24');
    expect(json.content).toContain(json.header);
  });

  it('reads a plain number as the hour text, the same as the string', async () => {
    const asNumber = await call('/at', { body: { hour: 9, minute: 0, timezone: 'GMT+2' } });
    const asString = await call('/at', { body: { hour: '9', minute: 0, timezone: 'GMT+2' } });

    expect(asNumber.status).toBe(200);
    expect(asNumber.json.unix).toBe(asString.json.unix);
    expect(asNumber.json.usingAtHoursOnly).toBe(true);
  });

  it('does not turn numbers into text for the other text options', async () => {
    // A number can not carry a snowflake id without losing digits, so only the hour is allowed to
    expect((await call('/snowflake', { body: { value: 175928847299117063 } })).status).toBe(400);
    expect((await call('/at', { body: { hour: '9', timezone: 5 } })).status).toBe(400);
  });

  it('falls back to the saved settings', async () => {
    backend.settings.set(DISCORD_USER_ID, { ...(await backend.getSettings(DISCORD_USER_ID)), timezone: 'GMT-5', defaultAtMinute: 30 });
    expect((await call('/at', { body: { hour: '9' } })).json.unix).toBe(unixOf('2022-04-24T14:30:00Z'));
  });

  it('replies with just the preview for a single format with the minimal reply setting', async () => {
    const { json } = await call('/unix', { body: { value: 1650802953, format: 'R' } });
    expect(json.formats).toEqual([{ format: 'R', timestamp: '<t:1650802953:R>' }]);
    expect(json.content).toBe('<t:1650802953:R>');
    expect(json.header).toBeNull();
  });

  it('says which format was asked for and whether the reply is minimal', async () => {
    expect((await call('/unix', { body: { value: 0, format: 'R' } })).json).toMatchObject({ singleFormat: 'R', minimalReply: true });
    expect((await call('/unix', { body: { value: 0 } })).json).toMatchObject({ singleFormat: null, minimalReply: false });
    backend.settings.set(DISCORD_USER_ID, { ...(await backend.getSettings(DISCORD_USER_ID)), formatMinimalReply: false });
    expect((await call('/unix', { body: { value: 0, format: 'R' } })).json).toMatchObject({ singleFormat: 'R', minimalReply: false });
  });

  it('flags a bare 24-hour value for at, and only there', async () => {
    expect((await call('/at', { body: { hour: '9', minute: 0 } })).json.usingAtHoursOnly).toBe(true);
    expect((await call('/at', { body: { hour: '9pm', minute: 0 } })).json.usingAtHoursOnly).toBe(false);
    expect((await call('/unix', { body: { value: 0 } })).json).not.toHaveProperty('usingAtHoursOnly');
  });

  it('lets an explicit "all" format override a saved format', async () => {
    backend.settings.set(DISCORD_USER_ID, { ...(await backend.getSettings(DISCORD_USER_ID)), format: 'R' as never });
    expect((await call('/unix', { body: { value: 0, format: 'all' } })).json.formats).toHaveLength(9);
    expect((await call('/unix', { body: { value: 0 } })).json.formats).toHaveLength(1);
  });

  it('supports relative, offset and snowflake commands', async () => {
    expect((await call('/in', { body: { hours: 1 } })).json.unix).toBe(NOW / 1000 + 3600);
    expect((await call('/ago', { body: { minutes: 30 } })).json.unix).toBe(NOW / 1000 - 1800);
    expect((await call('/add', { body: { to: 0, days: 1 } })).json.unix).toBe(86400);
    expect((await call('/subtract', { body: { from: 86400, days: 1 } })).json.unix).toBe(0);
    expect((await call('/snowflake', { body: { value: '175928847299117063' } })).json.unix).toBe(1462015105);
    expect((await call('/iso', { body: { value: '2022-04-24T10:00:00Z' } })).json.unix).toBe(unixOf('2022-04-24T10:00:00Z'));
    expect((await call('/at12', { body: { hour: 3, pm: true, minute: 0 } })).json.unix).toBe(unixOf('2022-04-24T15:00:00Z'));
  });

  it('answers rejected input with the bot\'s locale key and English message', async () => {
    expect((await call('/at', { body: { hour: '25' } }))).toMatchObject({
      status: 400,
      json: { error: { code: 'commands.at.responses.hourRange', message: 'When a meridiem is not specified, hour must be a number between 0 and 23' } },
    });
    expect((await call('/in', { body: {} })).json.error).toMatchObject({
      code: 'commands.global.responses.noComponentsCurrentTime',
      params: { atCommand: 'at' },
      message: expect.stringContaining('`/at`'),
    });
    expect((await call('/at', { body: { hour: '5', timezone: 'Nowhere/Land' } })).json.error.message)
      .toBe('The provided timezone (Nowhere/Land) is not supported');
  });

  it('validates the body against the generated schema', async () => {
    const { status, json } = await call('/at', { body: { month: 13, unknown: 1 } });
    expect(status).toBe(400);
    expect(json.error.code).toBe('invalid_request');
    expect(json.error.issues).toEqual([{ path: 'month', message: expect.any(String) }]);
    expect((await call('/add', { body: { days: 1 } })).json.error.issues[0].path).toBe('to');
    expect((await call('/unix', { body: { value: 0, columns: 'sideways' } })).status).toBe(400);
  });

  it('has an endpoint for exactly the commands that have a resolver', () => {
    expect([...commandNames].sort()).toEqual(Object.keys(commandResolvers).sort());
  });
});

describe('telemetry', () => {
  it('records the run like the bot and shows the run count', async () => {
    const first = await call('/at', { body: { hour: '9', minute: 0 } });
    expect(first.json.telemetry).toMatchObject({ executionNumber: 1, command: 'at', privacyPolicyUrl: expect.stringContaining('/legal') });
    expect(first.json.telemetry.note).toContain('This is execution #1 for the /at command');
    expect(first.json.telemetry.note).toContain('[Privacy Policy](https://hammertime.example/legal#telemetry-statistics)');
    expect((await call('/at', { body: { hour: '9' } })).json.telemetry.executionNumber).toBe(2);
    expect(backend.telemetryCalls[0]).toEqual({
      commandName: 'at',
      locale: 'en-US',
      source: 'api',
      options: [{ name: 'hour', type: 3 }, { name: 'minute', type: 4 }],
    });
  });

  it('is skipped entirely when the account opted out', async () => {
    await call('/settings', { method: 'PATCH', body: { telemetry: false } });
    const { status, json } = await call('/unix', { body: { value: 0 } });
    expect(status).toBe(200);
    expect(json.telemetry).toBeUndefined();
    expect(backend.telemetryCalls).toHaveLength(0);
  });

  it('is not recorded for rejected input', async () => {
    await call('/at', { body: { hour: '25' } });
    expect(backend.telemetryCalls).toHaveLength(0);
  });

  it.each(['throw', 'hang', 'decline'] as const)('never fails the request when the backend %s', async (mode) => {
    backend.telemetryMode = mode;
    const { status, json } = await call('/unix', { body: { value: 0 } });
    expect(status).toBe(200);
    expect(json.telemetry).toBeUndefined();
  });
});

describe('a backend that fails', () => {
  it('answers 502 and says why in the log', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    backend.getSettings = async () => { throw new BackendError(502, 'The backend answered with HTTP 403'); };

    const { status, json } = await call('/settings', { method: 'GET' });

    expect(status).toBe(502);
    expect(json.error.code).toBe('backend_error');
    expect(error).toHaveBeenCalledWith(expect.stringContaining('HTTP 403'));
    error.mockRestore();
  });

  it('does not log a read-only window, which is nobody\'s fault', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    backend.readOnly = true;

    expect((await call('/settings', { method: 'PATCH', body: { header: false } })).status).toBe(503);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('settings', () => {
  it('returns the saved settings', async () => {
    const { status, json } = await call('/settings', { method: 'GET' });
    expect(status).toBe(200);
    expect(json).toMatchObject({ timezone: 'GMT', telemetry: true, defaultAtSecond: 0, format: null });
  });

  it('changes only the given settings, and null resets one', async () => {
    expect((await call('/settings', { method: 'PATCH', body: { timezone: 'GMT+2', defaultAtHour: 7 } })).json)
      .toMatchObject({ timezone: 'GMT+2', defaultAtHour: 7, header: true });
    expect((await call('/settings', { method: 'PATCH', body: { timezone: null } })).json).toMatchObject({ timezone: 'GMT', defaultAtHour: 7 });
  });

  it('validates values', async () => {
    const { status, json } = await call('/settings', { method: 'PATCH', body: { defaultAtHour: 24, format: 'x' } });
    expect(status).toBe(400);
    expect(json.error.issues.map((issue: { path: string }) => issue.path).sort()).toEqual(['defaultAtHour', 'format']);
  });

  it('needs the write scope to change settings', async () => {
    backend.keys.set('read-only', { kind: 'user', discordUserId: DISCORD_USER_ID, scopes: ['settings:read'], keyId: 'k' });
    expect((await call('/settings', { method: 'GET', token: 'read-only' })).status).toBe(200);
    expect((await call('/settings', { method: 'PATCH', token: 'read-only', body: { header: false } })).status).toBe(403);
  });

  it('passes the read-only deploy window through as a 503 with Retry-After', async () => {
    backend.readOnly = true;
    const response = await call('/settings', { method: 'PATCH', body: { header: false } });
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('5');
  });
});
