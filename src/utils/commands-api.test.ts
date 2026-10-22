import { describe, expect, it, vi } from 'vitest';
import { ILogger } from '../types/logger-types.js';
import { createCommandsApiClient } from './commands-api.js';

const timestamp = {
  command: 'at',
  unix: 1650802953,
  timezone: 'GMT+2',
  header: null,
  content: '<t:1650802953:R>',
  singleFormat: 'R',
  minimalReply: true,
  telemetry: { executionNumber: 7, command: 'at', privacyPolicyUrl: 'https://example.test/legal', note: 'ignored' },
};

const reply = (status: number, body?: unknown) =>
  new Response(body === undefined ? 'not json' : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const setup = (respond: (url: string, init: RequestInit) => Response | Promise<Response>, timeoutMs = 1500) => {
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => respond(String(url), init ?? {}));
  const warn = vi.fn();
  const client = createCommandsApiClient({ url: 'https://api.test/', key: 'htk_secret-key', timeoutMs, fetch: fetchMock as unknown as typeof fetch })!;
  return { client, fetchMock, warn, logger: { warn } as unknown as ILogger };
};

describe('createCommandsApiClient', () => {
  it('is nothing without an address and a key', () => {
    expect(createCommandsApiClient({ url: '', key: 'k', timeoutMs: 100 })).toBeNull();
    expect(createCommandsApiClient({ url: 'https://api.test', key: '', timeoutMs: 100 })).toBeNull();
  });

  it('asks as the bot, for the account of the user, with the options that were given', async () => {
    const { client, fetchMock, logger } = setup(() => reply(200, timestamp));

    await client.run(logger, '175928847299117063', 'at', { hour: '9', timezone: 'GMT+2' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.test/at');
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer htk_secret-key');
    expect(headers.get('X-Discord-User-Id')).toBe('175928847299117063');
    expect(JSON.parse(init?.body as string)).toEqual({ hour: '9', timezone: 'GMT+2' });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('returns what the API resolved', async () => {
    const { client, logger, warn } = setup(() => reply(200, timestamp));

    const result = await client.run(logger, '1', 'at', {});

    expect(result).toEqual({ type: 'timestamp', body: expect.objectContaining({ unix: 1650802953, content: '<t:1650802953:R>', telemetry: expect.objectContaining({ executionNumber: 7 }) }) });
    expect(warn).not.toHaveBeenCalled();
  });

  it('returns input the API rejected, as the error the bot already knows how to word', async () => {
    const { client, logger, warn } = setup(() => reply(400, {
      error: { code: 'commands.global.responses.unsupportedTimezone', message: 'x', params: { timezone: 'Nowhere' } },
    }));

    expect(await client.run(logger, '1', 'at', {})).toEqual({
      type: 'rejected',
      error: { error: 'commands.global.responses.unsupportedTimezone', params: { timezone: 'Nowhere' } },
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('leaves a rejection it has no message for to the caller', async () => {
    const { client, logger, warn } = setup(() => reply(400, { error: { code: 'invalid_request', message: 'The request does not match' } }));

    expect(await client.run(logger, '1', 'at', {})).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('HTTP 400'));
  });

  it.each([401, 403, 404, 429, 500, 502, 503])('gives the command back to the caller on HTTP %i, saying why', async (status) => {
    const { client, logger, warn } = setup(() => reply(status, { error: { code: 'x', message: 'y' } }));

    expect(await client.run(logger, '1', 'at', {})).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`HTTP ${status}`));
  });

  it('gives the command back when the API cannot be reached', async () => {
    const { client, logger, warn } = setup(() => { throw new TypeError('fetch failed'); });

    expect(await client.run(logger, '1', 'at', {})).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('fetch failed'));
  });

  it('gives up after the time it was told to wait', async () => {
    // Never answers, but respects the abort signal like a real request does
    const { client, logger, warn } = setup((_url, init) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    }), 50);
    const startedAt = Date.now();

    expect(await client.run(logger, '1', 'at', {})).toBeNull();

    expect(Date.now() - startedAt).toBeLessThan(1000);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no answer within 50ms'));
  });

  it('does not trust an answer of the wrong shape', async () => {
    const { client, logger, warn } = setup(() => reply(200, { ...timestamp, unix: 'tomorrow' }));

    expect(await client.run(logger, '1', 'at', {})).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unexpected response'));
    expect(await setup(() => reply(200)).client.run(logger, '1', 'at', {})).toBeNull();
  });

  it('never writes the key to the log', async () => {
    const { client, logger, warn } = setup(() => reply(401, { error: { code: 'unauthorized', message: 'Bearer htk_secret-key' } }));

    await client.run(logger, '1', 'at', {});

    expect(JSON.stringify(warn.mock.calls)).not.toContain('htk_secret-key');
  });
});
