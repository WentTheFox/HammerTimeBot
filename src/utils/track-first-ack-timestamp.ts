const ACK_METHOD_NAMES = ['reply', 'deferReply', 'update', 'deferUpdate', 'showModal', 'respond'] as const;

export interface AckTiming {
  /** When the first ack method was invoked, i.e. when the handler got as far as trying to respond */
  ackCalledAt?: number;
  /** When that first invocation settled, successfully or not - `ackSettledAt - ackCalledAt` is the REST call's own duration */
  ackSettledAt?: number;
  /** When the first successful ack resolved */
  ackedAt?: number;
}

/**
 * Wraps whichever of an interaction's ack-establishing methods exist (`reply`/`deferReply` for
 * commands, `update`/`deferUpdate` for components, `showModal`, `respond` for autocomplete), so the
 * first one that resolves records `ackTiming.ackedAt`. These are real discord.js methods here (see
 * interactionFromWebhookPayload) - they make their own REST call straight to Discord's
 * interaction-callback endpoint the moment they're invoked, independent of whatever this webhook
 * server's own HTTP response ends up containing. That's the moment Discord actually got
 * acknowledged - not whenever the rest of the handler (e.g. a slow post-defer editReply) finishes -
 * so it's what `duration_ms` in webhook.ts should measure against, deferReply included.
 *
 * Also records when that first ack call started and settled, which is what tells a slow handler
 * apart from a slow (or silently retried - @discordjs/rest retries timed-out requests without
 * emitting anything) callback request to Discord when an interaction expires.
 */
export function trackFirstAckTimestamp(interaction: object, ackTiming: AckTiming): void {
  const target = interaction as Record<string, unknown>;
  for (const name of ACK_METHOD_NAMES) {
    const original = target[name];
    if (typeof original !== 'function') continue;
    target[name] = async function (this: unknown, ...args: unknown[]) {
      const isFirstCall = ackTiming.ackCalledAt === undefined;
      ackTiming.ackCalledAt ??= Date.now();
      try {
        const result: unknown = await (original as (...a: unknown[]) => unknown).apply(this, args);
        ackTiming.ackedAt ??= Date.now();
        return result;
      } finally {
        if (isFirstCall) ackTiming.ackSettledAt = Date.now();
      }
    };
  }
}
