import { AckTiming } from './track-first-ack-timestamp.js';

/**
 * Discord's hard deadline for acknowledging an interaction is 3s from its creation - anything past
 * this is already cutting it close, so it gets logged before it turns into an outright expiry.
 */
export const SLOW_WEBHOOK_DELIVERY_THRESHOLD_MS = 2000;

export interface WebhookDeliveryTiming extends AckTiming {
  /** When this server started handling the HTTP request */
  receivedAt: number;
  /** When the whole request (handler included) finished */
  finishedAt: number;
  /**
   * The request's X-Signature-Timestamp header (unix seconds) - when Discord signed, i.e. sent, the
   * request. Only second precision, but that's enough to tell a late delivery apart from a slow
   * network hop or a slow handler.
   */
  signedAtSeconds?: number;
  interactionId?: string;
  /** Interaction snowflake's creation time, i.e. when Discord's 3s deadline started ticking */
  interactionCreatedAt?: number;
  /** Short human-readable description of the interaction, e.g. its type and command name */
  interactionDescription?: string;
}

const ms = (from: number | undefined, to: number | undefined): string =>
  from === undefined || to === undefined ? '?' : `${to - from}ms`;

/**
 * Builds a phase-by-phase breakdown for a webhook delivery that was acknowledged too slowly (or not
 * at all), or returns null for one that was fine / isn't an interaction (Ping, signature rejection).
 *
 * The phases, in order: Discord creating the interaction → Discord sending it (signature
 * timestamp) → this server receiving it → the handler calling an ack method → that REST call to
 * Discord settling. Whichever gap is large says where the time went. The first two are measured
 * against Discord's clock, the rest against ours, so a few ms of clock skew is expected there.
 */
export function describeSlowWebhookDelivery(timing: WebhookDeliveryTiming): string | null {
  const { interactionCreatedAt: createdAt, receivedAt, ackCalledAt, ackSettledAt, ackedAt, finishedAt } = timing;
  if (createdAt === undefined) return null;

  const ackOutcome = ackedAt !== undefined ? 'acknowledged' : 'NOT acknowledged';
  const totalMs = (ackedAt ?? finishedAt) - createdAt;
  if (ackedAt !== undefined && totalMs <= SLOW_WEBHOOK_DELIVERY_THRESHOLD_MS) return null;

  let ackCallPhase: string;
  if (ackCalledAt === undefined) {
    ackCallPhase = 'no ack method was called';
  } else if (ackSettledAt === undefined) {
    ackCallPhase = `ack call still pending after ${ms(ackCalledAt, finishedAt)}`;
  } else {
    ackCallPhase = `ack call ${ackedAt !== undefined && ackedAt <= ackSettledAt ? 'succeeded' : 'failed'} after ${ms(ackCalledAt, ackSettledAt)}`;
  }

  const phases = [
    `created→sent by Discord ${timing.signedAtSeconds === undefined ? '?' : `~${ms(createdAt, timing.signedAtSeconds * 1000)}`}`,
    `created→received ${ms(createdAt, receivedAt)}`,
    `received→ack call ${ackCalledAt === undefined ? 'n/a' : ms(receivedAt, ackCalledAt)}`,
    ackCallPhase,
    `received→finished ${ms(receivedAt, finishedAt)}`,
  ];
  const description = timing.interactionDescription ? ` (${timing.interactionDescription})` : '';

  return `Slow webhook delivery${description}, ${ackOutcome} ${totalMs}ms after creation: ${phases.join(', ')}`;
}
