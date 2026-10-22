import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { commandNames } from './generated/commands.js';
import { DISCORD_USER_ID, FakeBackend, SERVICE_TOKEN, USER_TOKEN } from './testing/fake-backend.js';

const NOW = Date.parse('2022-04-24T12:22:33.000Z');
const unixOf = (iso: string) => Date.parse(iso) / 1000;

let backend: FakeBackend;
let app: ReturnType<typeof createApp>;
const clients: Client[] = [];

beforeEach(() => {
  backend = new FakeBackend();
  app = createApp({ backend, now: () => NOW, telemetryTimeoutMs: 50 });
});

afterEach(async () => {
  await Promise.all(clients.splice(0).map(client => client.close()));
});

/** A real MCP client, talking to the app in-process */
const connect = async (token: string = USER_TOKEN): Promise<Client> => {
  const transport = new StreamableHTTPClientTransport(new URL('http://api.test/mcp'), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
    fetch: ((input: string | URL | Request, init?: RequestInit) => app.fetch(new Request(input, init))) as typeof fetch,
  });
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(transport);
  clients.push(client);
  return client;
};

const textOf = (result: Awaited<ReturnType<Client['callTool']>>): string => {
  const [first] = result.content as { type: string; text: string }[];
  return first.text;
};

const addKey = (token: string, scopes: string[]) =>
  backend.keys.set(token, { kind: 'user', discordUserId: DISCORD_USER_ID, scopes, keyId: token });

describe('access', () => {
  const post = (token: string | null) => app.request('/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });

  it('needs an API key', async () => {
    const response = await post(null);
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
    expect((await post('nope')).status).toBe(401);
  });

  it('does not accept the bots service key, which acts for whichever account it names', async () => {
    const response = await post(SERVICE_TOKEN);
    expect(response.status).toBe(403);
    expect((await response.json()).error.message).toContain('service key');
  });

  it('is not part of the OpenAPI document', async () => {
    const document = await (await app.request('/generated/api-docs.json')).json();
    expect(Object.keys(document.paths)).not.toContain('/mcp');
  });
});

describe('tools', () => {
  it('has a tool for every bot command, and the settings', async () => {
    const { tools } = await (await connect()).listTools();

    expect(tools.map(tool => tool.name).sort()).toEqual([...commandNames, 'settings'].sort());
  });

  it('describes each tool like the command, with the same options', async () => {
    const { tools } = await (await connect()).listTools();
    const at = tools.find(tool => tool.name === 'at')!;
    const add = tools.find(tool => tool.name === 'add')!;

    expect(at.description).toContain("Equivalent to the bot's /at command");
    expect(Object.keys(at.inputSchema.properties!)).toEqual(
      expect.arrayContaining(['year', 'month', 'day', 'hour', 'hour12', 'am', 'pm', 'minute', 'second', 'timezone', 'format', 'header', 'columns', 'ephemeral']),
    );
    expect(at.inputSchema.properties!.month).toMatchObject({ type: 'integer', minimum: 1, maximum: 12 });
    expect(at.inputSchema.properties!.format).toMatchObject({ enum: expect.arrayContaining(['R', 'all']) });
    expect(add.inputSchema.required).toEqual(['to']);
  });

  it('only offers what the key may do', async () => {
    addKey('timestamps-only', ['timestamps:create']);
    addKey('settings-only', ['settings:read']);

    const timestampsOnly = (await (await connect('timestamps-only')).listTools()).tools.map(tool => tool.name);
    const settingsOnly = (await (await connect('settings-only')).listTools()).tools.map(tool => tool.name);

    expect(timestampsOnly).toEqual(expect.arrayContaining(['at', 'unix']));
    expect(timestampsOnly).not.toContain('settings');
    expect(settingsOnly).toEqual(['settings']);
  });
});

describe('calling a command', () => {
  it('replies like the bot, as text and as structured data', async () => {
    const client = await connect();

    const result = await client.callTool({ name: 'at', arguments: { hour: '9', minute: 0, timezone: 'GMT+2' } });

    const expectedUnix = unixOf('2022-04-24T07:00:00Z');
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain(`<t:${expectedUnix}:R>`);
    expect(textOf(result)).toContain('2022-04-24');
    expect(result.structuredContent).toMatchObject({ command: 'at', unix: expectedUnix, timezone: 'GMT+2' });
  });

  it('reads a plain number as the hour text', async () => {
    const client = await connect();

    const result = await client.callTool({ name: 'at', arguments: { hour: 9, minute: 0, timezone: 'GMT+2' } });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ command: 'at', unix: unixOf('2022-04-24T07:00:00Z') });
  });

  it('uses the settings of the account the key acts as', async () => {
    backend.settings.set(DISCORD_USER_ID, { ...(await backend.getSettings(DISCORD_USER_ID)), timezone: 'GMT-5' });

    const result = await (await connect()).callTool({ name: 'at', arguments: { hour: '9', minute: 0 } });

    expect(result.structuredContent).toMatchObject({ unix: unixOf('2022-04-24T14:00:00Z') });
  });

  it('records the run as MCP usage and shows the run count', async () => {
    const client = await connect();

    const first = await client.callTool({ name: 'unix', arguments: { value: 0 } });
    const second = await client.callTool({ name: 'unix', arguments: { value: 0 } });

    expect(textOf(first)).toContain('This is execution #1 for the /unix command');
    expect(textOf(second)).toContain('This is execution #2 for the /unix command');
    expect(textOf(second)).toContain('Privacy Policy');
    expect(backend.telemetryCalls.map(call => call.source)).toEqual(['mcp', 'mcp']);
  });

  it('records nothing and adds no note when the account opted out', async () => {
    backend.settings.set(DISCORD_USER_ID, { ...(await backend.getSettings(DISCORD_USER_ID)), telemetry: false });

    const result = await (await connect()).callTool({ name: 'unix', arguments: { value: 0 } });

    expect(textOf(result)).not.toContain('execution #');
    expect(backend.telemetryCalls).toHaveLength(0);
  });

  it('does not fail because the telemetry did', async () => {
    backend.telemetryMode = 'throw';

    const result = await (await connect()).callTool({ name: 'unix', arguments: { value: 0 } });

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('<t:0:');
  });

  it('reports rejected input as a tool error with the bot\'s message', async () => {
    const result = await (await connect()).callTool({ name: 'at', arguments: { hour: '25' } });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe('When a meridiem is not specified, hour must be a number between 0 and 23');
    expect(result.structuredContent).toMatchObject({ error: { code: 'commands.at.responses.hourRange' } });
    expect(backend.telemetryCalls).toHaveLength(0);
  });

  it('rejects arguments that do not fit the schema', async () => {
    const client = await connect();

    const result = await client.callTool({ name: 'at', arguments: { month: 13 } }).catch((error: Error) => error);

    // The SDK answers with either a tool error or a protocol error, either way it names the field
    const message = result instanceof Error ? result.message : textOf(result);
    expect(message).toMatch(/month/i);
    expect(backend.telemetryCalls).toHaveLength(0);
  });

  it('covers the relative and offset commands', async () => {
    const client = await connect();

    expect((await client.callTool({ name: 'in', arguments: { hours: 1 } })).structuredContent).toMatchObject({ unix: NOW / 1000 + 3600 });
    expect((await client.callTool({ name: 'add', arguments: { to: 0, days: 1 } })).structuredContent).toMatchObject({ unix: 86400 });
    expect((await client.callTool({ name: 'snowflake', arguments: { value: '175928847299117063' } })).structuredContent).toMatchObject({ unix: 1462015105 });
  });
});

describe('the settings tool', () => {
  it('reads the settings when given no arguments', async () => {
    const result = await (await connect()).callTool({ name: 'settings', arguments: {} });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toMatchObject({ timezone: 'GMT', telemetry: true });
    expect(result.structuredContent).toMatchObject({ timezone: 'GMT' });
  });

  it('changes only the given settings, and null resets one', async () => {
    const client = await connect();

    const changed = await client.callTool({ name: 'settings', arguments: { timezone: 'GMT+2', defaultAtHour: 7 } });
    expect(JSON.parse(textOf(changed))).toMatchObject({ timezone: 'GMT+2', defaultAtHour: 7, header: true });

    const reset = await client.callTool({ name: 'settings', arguments: { timezone: null } });
    expect(JSON.parse(textOf(reset))).toMatchObject({ timezone: 'GMT', defaultAtHour: 7 });
  });

  it('needs the write scope to change settings', async () => {
    addKey('read-only', ['settings:read']);
    const client = await connect('read-only');

    expect((await client.callTool({ name: 'settings', arguments: {} })).isError).toBeFalsy();
    const denied = await client.callTool({ name: 'settings', arguments: { header: false } });
    expect(denied.isError).toBe(true);
    expect(textOf(denied)).toContain('settings:write');
  });

  it('reports the deploy window as a tool error with when to retry', async () => {
    backend.readOnly = true;

    const result = await (await connect()).callTool({ name: 'settings', arguments: { header: false } });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('read-only');
    expect(textOf(result)).toContain('5 seconds');
  });
});
