import { context, propagation, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';

// One span per Discord interaction (see docker/otel.cjs: a no-op unless tracing is configured). Only the interaction kind, the registered
// command name and timings are recorded: never user, guild, channel or message ids, option values or message content.
const tracer = trace.getTracer('hammertimebot');

export interface InteractionSpanInfo {
  /** e.g. `ChatInput`, `Autocomplete`, `Component`, `ContextMenu` */
  kind: string;
  /** a registered command name or the static part of a component id */
  name?: string;
}

export interface InteractionSpanTiming {
  receivedAt: number;
  ackCalledAt?: number;
  ackSettledAt?: number;
  ackedAt?: number;
}

/** Component ids may carry data after a separator, so only the leading identifier-like part is kept. */
export const componentNameFromCustomId = (customId: string): string => /^[A-Za-z0-9_-]{1,40}/.exec(customId)?.[0] ?? 'unknown';

export async function withInteractionSpan<T>(info: InteractionSpanInfo, timing: InteractionSpanTiming, run: () => Promise<T>): Promise<T> {
  const label = info.name ? `${info.kind} ${info.name}` : info.kind;
  return tracer.startActiveSpan(label, { kind: SpanKind.SERVER, attributes: { 'discord.interaction.type': info.kind, ...(info.name ? { 'discord.interaction.name': info.name } : {}) } }, async (span) => {
    try {
      return await run();
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.name : 'error' });
      throw error;
    } finally {
      // how long Discord took to be acknowledged: the 3 second limit is what makes a command fail for the user
      if (timing.ackCalledAt !== undefined) span.setAttribute('discord.ack.start_ms', timing.ackCalledAt - timing.receivedAt);
      if (timing.ackSettledAt !== undefined && timing.ackCalledAt !== undefined) span.setAttribute('discord.ack.rest_ms', timing.ackSettledAt - timing.ackCalledAt);
      span.setAttribute('discord.acked', timing.ackedAt !== undefined);
      span.end();
    }
  });
}

export interface BackendRequestSpanInfo {
  method: string;
  /** Static first path segment only (`settings`, not `settings/<user id>`): ids never go into a span. */
  route: string;
  /** Host of the backend API, so a slow hop can be told apart from a slow app. */
  host?: string;
  timeoutMs?: number;
  /** 1-based attempt number when the request is retried */
  attempt: number;
}

export interface BackendRequestSpanHandle {
  /** `traceparent` (and friends) to send with the request, so the backend's spans join this trace. Empty when tracing is off. */
  headers: Record<string, string>;
  setStatus(status: number): void;
}

/** The static leading path segment of an API path, safe to record. */
export const routeFromApiPath = (path: string): string => /^\/?([A-Za-z0-9_-]{1,40})/.exec(path)?.[1] ?? 'unknown';

/**
 * A CLIENT span around one HTTP attempt to the backend API. This is deliberately hand-made instead of the HTTP instrumentation (see
 * docker/otel.cjs: that would record the webhook URL). Because the same trace id is sent to the backend as a `traceparent` header, the
 * collector's tail sampling keeps or drops both halves together: a slow or failed request here keeps the backend's spans too, so the time
 * can be split into backend work versus connect/TLS/ingress.
 */
export async function withBackendRequestSpan<T>(info: BackendRequestSpanInfo, run: (handle: BackendRequestSpanHandle) => Promise<T>): Promise<T> {
  const attributes = {
    'http.request.method': info.method,
    'http.route': info.route,
    'backend.attempt': info.attempt,
    ...(info.host ? { 'server.address': info.host } : {}),
    ...(info.timeoutMs !== undefined ? { 'http.client.timeout_ms': info.timeoutMs } : {}),
  };
  return tracer.startActiveSpan(`${info.method} ${info.route}`, { kind: SpanKind.CLIENT, attributes }, async (span) => {
    const headers: Record<string, string> = {};
    propagation.inject(context.active(), headers);
    try {
      return await run({ headers, setStatus: (status) => span.setAttribute('http.response.status_code', status) });
    } catch (error) {
      const timedOut = error instanceof Error && /timed out/i.test(error.message);
      const status = (error as { status?: unknown } | undefined)?.status;
      if (typeof status === 'number') span.setAttribute('http.response.status_code', status);
      span.setAttribute('error.type', timedOut ? 'timeout' : error instanceof Error ? error.name : 'error');
      span.setStatus({ code: SpanStatusCode.ERROR, message: timedOut ? 'timeout' : error instanceof Error ? error.name : 'error' });
      throw error;
    } finally {
      span.end();
    }
  });
}
