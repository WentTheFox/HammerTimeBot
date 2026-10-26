import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backendApiRequest } from './backend-api-request.js';
import { ILogger } from '../types/logger-types.js';

vi.mock('../env.js', () => ({ env: { API_URL: 'https://backend.test', API_TOKEN: 'token' } }));

const createLogger = () => {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    nest: () => logger,
    muteMethods: () => logger,
  };
  return logger as unknown as ILogger & Record<'debug' | 'info' | 'warn' | 'error', ReturnType<typeof vi.fn>>;
};

const validator = (data: unknown) => ({ success: true as const, data: data as Record<string, unknown> });
const failure = (status: number) => new Response('upstream broke', { status, statusText: 'Broken' });
const success = () => new Response(JSON.stringify({ success: true }), { status: 200 });

describe('backendApiRequest', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  const run = async (logger: ILogger, retry?: { maxAttempts: number; initialDelayMs: number }) => {
    const promise = backendApiRequest({ logger }, { path: '/x', method: 'POST', body: {}, validator, retry });
    await vi.runAllTimersAsync();
    return promise;
  };

  it('does not log warnings or errors for attempts that get retried', async () => {
    const logger = createLogger();
    fetchMock.mockResolvedValueOnce(failure(504)).mockResolvedValueOnce(failure(504)).mockResolvedValueOnce(success());

    const result = await run(logger, { maxAttempts: 4, initialDelayMs: 10 });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledTimes(2);
  });

  it('logs the last failure in full once retries are exhausted', async () => {
    const logger = createLogger();
    fetchMock.mockImplementation(async () => failure(504));

    const result = await run(logger, { maxAttempts: 3, initialDelayMs: 10 });

    expect(result).toMatchObject({ ok: false, status: 504 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('does not retry client errors', async () => {
    const logger = createLogger();
    fetchMock.mockImplementation(async () => failure(422));

    const result = await run(logger, { maxAttempts: 5, initialDelayMs: 10 });

    expect(result).toMatchObject({ ok: false, status: 422 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('makes a single attempt and logs straight away without retry options', async () => {
    const logger = createLogger();
    fetchMock.mockImplementation(async () => failure(503));

    const result = await run(logger);

    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
