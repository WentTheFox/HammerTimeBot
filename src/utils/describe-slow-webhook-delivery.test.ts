import { describe, expect, it } from 'vitest';
import { describeSlowWebhookDelivery } from './describe-slow-webhook-delivery.js';

const createdAt = 1_790_000_000_000;

describe('describeSlowWebhookDelivery', () => {
  it('returns null for requests that never got as far as an interaction', () => {
    expect(describeSlowWebhookDelivery({ receivedAt: createdAt, finishedAt: createdAt + 60_000 })).toBeNull();
  });

  it('returns null for an interaction acknowledged quickly', () => {
    expect(describeSlowWebhookDelivery({
      interactionCreatedAt: createdAt,
      receivedAt: createdAt + 100,
      ackCalledAt: createdAt + 110,
      ackSettledAt: createdAt + 300,
      ackedAt: createdAt + 300,
      // A slow post-ack remainder of the handler doesn't count
      finishedAt: createdAt + 10_000,
    })).toBeNull();
  });

  it('returns null for an interaction acknowledged late, as long as the ack succeeded', () => {
    expect(describeSlowWebhookDelivery({
      interactionCreatedAt: createdAt,
      signedAtSeconds: createdAt / 1000 + 2.515,
      receivedAt: createdAt + 3611,
      ackCalledAt: createdAt + 3694,
      ackSettledAt: createdAt + 4050,
      ackedAt: createdAt + 4050,
      finishedAt: createdAt + 4051,
    })).toBeNull();
  });

  it('breaks down a late delivery by Discord', () => {
    expect(describeSlowWebhookDelivery({
      interactionCreatedAt: createdAt,
      signedAtSeconds: createdAt / 1000 + 12,
      receivedAt: createdAt + 12_600,
      ackCalledAt: createdAt + 12_605,
      ackSettledAt: createdAt + 12_667,
      finishedAt: createdAt + 12_670,
      interactionDescription: 'ApplicationCommandAutocomplete /at',
    })).toBe('Slow webhook delivery (ApplicationCommandAutocomplete /at), NOT acknowledged 12670ms after creation: '
      + 'created→sent by Discord ~12000ms, created→received 12600ms, received→ack call 5ms, ack call failed after 62ms, received→finished 70ms');
  });

  it('breaks down a slow callback request', () => {
    expect(describeSlowWebhookDelivery({
      interactionCreatedAt: createdAt,
      receivedAt: createdAt + 100,
      ackCalledAt: createdAt + 105,
      ackSettledAt: createdAt + 22_000,
      finishedAt: createdAt + 22_006,
    })).toBe('Slow webhook delivery, NOT acknowledged 22006ms after creation: '
      + 'created→sent by Discord ?, created→received 100ms, received→ack call 5ms, ack call failed after 21895ms, received→finished 21906ms');
  });

  it('reports a first ack call that failed even if a later one succeeded', () => {
    expect(describeSlowWebhookDelivery({
      interactionCreatedAt: createdAt,
      receivedAt: createdAt + 100,
      ackCalledAt: createdAt + 105,
      ackSettledAt: createdAt + 4000,
      ackedAt: createdAt + 4500,
      finishedAt: createdAt + 4500,
    })).toContain('ack call failed after 3895ms');
  });

  it('includes the CF-Ray header when present', () => {
    expect(describeSlowWebhookDelivery({
      interactionCreatedAt: createdAt,
      receivedAt: createdAt + 3000,
      finishedAt: createdAt + 3500,
      cfRay: '8c1a2b3c4d5e6f70-IAD',
    })).toMatch(/, cf-ray=8c1a2b3c4d5e6f70-IAD$/);
  });

  it('reports when no ack method was ever called', () => {
    expect(describeSlowWebhookDelivery({
      interactionCreatedAt: createdAt,
      receivedAt: createdAt + 100,
      finishedAt: createdAt + 3500,
    })).toContain('received→ack call n/a, no ack method was called');
  });
});
