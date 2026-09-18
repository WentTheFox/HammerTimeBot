const ACK_METHOD_NAMES = ['reply', 'deferReply', 'update', 'deferUpdate', 'showModal', 'respond'] as const;

/**
 * Wraps whichever of an interaction's ack-establishing methods exist (`reply`/`deferReply` for
 * commands, `update`/`deferUpdate` for components, `showModal`, `respond` for autocomplete), so the
 * first one that resolves records `ackTiming.ackedAt`. These are real discord.js methods here (see
 * interactionFromWebhookPayload) - they make their own REST call straight to Discord's
 * interaction-callback endpoint the moment they're invoked, independent of whatever this webhook
 * server's own HTTP response ends up containing. That's the moment Discord actually got
 * acknowledged - not whenever the rest of the handler (e.g. a slow post-defer editReply) finishes -
 * so it's what `duration_ms` in webhook.ts should measure against, deferReply included.
 */
export function trackFirstAckTimestamp(interaction: object, ackTiming: { ackedAt?: number }): void {
  const target = interaction as Record<string, unknown>;
  for (const name of ACK_METHOD_NAMES) {
    const original = target[name];
    if (typeof original !== 'function') continue;
    target[name] = async function (this: unknown, ...args: unknown[]) {
      const result: unknown = await (original as (...a: unknown[]) => unknown).apply(this, args);
      ackTiming.ackedAt ??= Date.now();
      return result;
    };
  }
}
