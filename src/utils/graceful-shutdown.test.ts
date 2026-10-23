import { createServer, request, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { announceReady, shutdownGracefully } from './graceful-shutdown.js';

type Handler = () => void;

const fakeProcess = () => {
  const handlers = new Map<string, Handler>();
  const exit = vi.fn();
  const proc = {
    on: ((signal: string, handler: Handler) => {
      handlers.set(signal, handler);
      return proc;
    }) as unknown as NodeJS.Process['on'],
    exit: exit as unknown as NodeJS.Process['exit'],
    send: undefined,
  };

  return { proc, exit, signal: (name: string) => handlers.get(name)?.() };
};

const listen = (server: Server) => new Promise<number>((resolve) => {
  server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
});

const get = (port: number) => new Promise<{ status: number | undefined; body: string }>((resolve, reject) => {
  // No keep-alive, so the connection is the request
  const req = request({ port, host: '127.0.0.1', agent: false }, (res) => {
    let body = '';
    res.on('data', (chunk: Buffer) => body += chunk.toString());
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  req.on('error', reject);
  req.end();
});

const exited = (exit: ReturnType<typeof vi.fn>) => vi.waitFor(() => expect(exit).toHaveBeenCalled());

let server: Server | null = null;
afterEach(() => {
  server?.closeAllConnections();
  server?.close();
  server = null;
});

describe('shutdownGracefully', () => {
  it('finishes the request in flight, refuses new ones, and exits cleanly', async () => {
    let release: () => void = () => undefined;
    server = createServer((_req, res) => {
      release = () => res.end('done');
    });
    const port = await listen(server);
    const { proc, exit, signal } = fakeProcess();
    shutdownGracefully(server, { process: proc, timeoutMs: 5_000 });

    const inFlight = get(port);
    await vi.waitFor(() => expect(release).not.toBe(undefined));
    await vi.waitFor(() => expect(server?.listening).toBe(true));
    // Let the server see the request before the signal arrives
    await new Promise(resolve => setTimeout(resolve, 50));
    signal('SIGTERM');

    await expect(get(port)).rejects.toThrow();
    expect(exit).not.toHaveBeenCalled();

    release();
    await expect(inFlight).resolves.toEqual({ status: 200, body: 'done' });
    await exited(exit);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('cuts off a request that is still running after the timeout, and says it failed', async () => {
    server = createServer(() => undefined);
    const port = await listen(server);
    const log = vi.fn();
    const { proc, exit, signal } = fakeProcess();
    shutdownGracefully(server, { process: proc, timeoutMs: 100, log });

    const stuck = get(port).catch(() => 'cut off');
    await new Promise(resolve => setTimeout(resolve, 50));
    signal('SIGINT');

    await exited(exit);
    expect(exit).toHaveBeenCalledWith(1);
    await expect(stuck).resolves.toBe('cut off');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('closing them'));
  });

  it('exits at once when nothing is running, and handles a second signal as the first', async () => {
    server = createServer((_req, res) => res.end());
    await listen(server);
    const { proc, exit, signal } = fakeProcess();
    shutdownGracefully(server, { process: proc });

    signal('SIGINT');
    signal('SIGTERM');

    await exited(exit);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });
});

describe('announceReady', () => {
  it('tells pm2 the worker is listening', () => {
    const send = vi.fn();

    announceReady({ send } as unknown as NodeJS.Process);

    expect(send).toHaveBeenCalledWith('ready');
  });

  it('does nothing when there is no parent process to tell', () => {
    expect(() => announceReady({ send: undefined })).not.toThrow();
  });
});
