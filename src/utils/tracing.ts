import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';

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
