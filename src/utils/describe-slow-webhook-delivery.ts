import { AckTiming } from './track-first-ack-timestamp.js';

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
  /**
   * The request's CF-Ray header - its suffix is the Cloudflare data center (IATA code) that received
   * the request from Discord, and the whole ID can be looked up in Cloudflare's logs.
   */
  cfRay?: string;
  interactionId?: string;
  /** Interaction snowflake's creation time, i.e. when Discord's 3s deadline started ticking */
  interactionCreatedAt?: number;
  /** Short human-readable description of the interaction, e.g. its type and command name */
  interactionDescription?: string;
}

const ms = (from: number | undefined, to: number | undefined): string =>
  from === undefined || to === undefined ? '?' : `${to - from}ms`;

/**
 * Builds a phase-by-phase breakdown for a webhook delivery whose first ack call didn't succeed (the
 * interaction expired, or Discord rejected the callback), or returns null for one that was
 * acknowledged / isn't an interaction (Ping, signature rejection). A late but successful ack isn't
 * reported: the creation timestamp is measured against Discord's clock, not the deadline Discord
 * actually enforces, so acks well past 3s "after creation" routinely succeed and aren't a problem.
 *
 * The phases, in order: Discord creating the interaction → Discord sending it (signature
 * timestamp) → this server receiving it → the handler calling an ack method → that REST call to
 * Discord settling. Whichever gap is large says where the time went. The first two are measured
 * against Discord's clock, the rest against ours, so a few ms of clock skew is expected there.
 */
export function describeSlowWebhookDelivery(timing: WebhookDeliveryTiming): string | null {
  const { interactionCreatedAt: createdAt, receivedAt, ackCalledAt, ackSettledAt, ackedAt, finishedAt } = timing;
  if (createdAt === undefined) return null;

  const firstAckSucceeded = ackedAt !== undefined && ackSettledAt !== undefined && ackedAt <= ackSettledAt;
  if (firstAckSucceeded) return null;

  const ackOutcome = ackedAt !== undefined ? 'acknowledged' : 'NOT acknowledged';
  const totalMs = (ackedAt ?? finishedAt) - createdAt;

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
  if (timing.cfRay) phases.push(`cf-ray=${timing.cfRay}`);
  const description = timing.interactionDescription ? ` (${timing.interactionDescription})` : '';

  return `Slow webhook delivery${description}, ${ackOutcome} ${totalMs}ms after creation: ${phases.join(', ')}`;
}
