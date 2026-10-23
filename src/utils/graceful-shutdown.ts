import type { Server } from 'node:http';

export interface GracefulShutdownOptions {
  /**
   * How long requests in flight get to finish. Shorter than pm2's kill_timeout, so the exit is ours and not a SIGKILL.
   */
  timeoutMs?: number;
  log?: (message: string) => void;
  /**
   * Injectable for tests
   */
  process?: Pick<NodeJS.Process, 'on' | 'exit' | 'send'>;
}

export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 8_000;

/**
 * Tells pm2 that this worker is listening. With `wait_ready` in pm2.json a reload only stops the old worker once the new one
 * has said so, which is what keeps a deploy from dropping requests. Does nothing outside of pm2 (there is no IPC channel).
 *
 * The same code is in packages/api, the two processes share no package that has Node's types.
 */
export const announceReady = (proc: Pick<NodeJS.Process, 'send'> = process): void => {
  proc.send?.('ready');
};

/**
 * Stops the server on SIGINT or SIGTERM, which is what pm2 sends: no new connections, the requests in flight are finished,
 * then the process exits. Whatever is still running after the timeout is cut off, so a stuck request can not hold a deploy up.
 */
export const shutdownGracefully = (server: Server, {
  timeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
  log = () => undefined,
  process: proc = process,
}: GracefulShutdownOptions = {}): void => {
  let stopping = false;

  const stop = (signal: string) => {
    // pm2 sends the signal again when it loses patience, the first one is already being handled
    if (stopping) return;
    stopping = true;
    log(`${signal} received, finishing the requests in flight`);

    const giveUp = setTimeout(() => {
      log(`Requests still running after ${timeoutMs}ms, closing them`);
      server.closeAllConnections();
      proc.exit(1);
    }, timeoutMs);
    // The timer must not be what keeps a finished process alive
    giveUp.unref();

    server.close((error) => {
      clearTimeout(giveUp);
      proc.exit(error ? 1 : 0);
    });
    // Connections that are only waiting for a next request are of no use to anyone
    server.closeIdleConnections();
  };

  proc.on('SIGINT', () => stop('SIGINT'));
  proc.on('SIGTERM', () => stop('SIGTERM'));
};
