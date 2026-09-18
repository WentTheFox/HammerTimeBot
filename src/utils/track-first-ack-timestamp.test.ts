import { describe, expect, it, vi } from 'vitest';
import { trackFirstAckTimestamp } from './track-first-ack-timestamp.js';

describe('trackFirstAckTimestamp', () => {
  it('records a timestamp once an ack method resolves', async () => {
    const interaction = { deferReply: vi.fn().mockResolvedValue(undefined) };
    const ackTiming: { ackedAt?: number } = {};
    trackFirstAckTimestamp(interaction, ackTiming);

    expect(ackTiming.ackedAt).toBeUndefined();
    await interaction.deferReply();
    expect(ackTiming.ackedAt).toBeTypeOf('number');
  });

  it('keeps the first ack timestamp even if a later ack method also resolves', async () => {
    const interaction = {
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
    };
    const ackTiming: { ackedAt?: number } = {};
    trackFirstAckTimestamp(interaction, ackTiming);

    await interaction.deferReply();
    const firstAckedAt = ackTiming.ackedAt;
    await new Promise((resolve) => setTimeout(resolve, 5));
    // editReply isn't one of the tracked methods, but calling it shouldn't disturb the recorded value.
    await interaction.editReply();
    expect(ackTiming.ackedAt).toBe(firstAckedAt);
  });

  it('still calls through to the original method and returns its result', async () => {
    const interaction = { reply: vi.fn().mockResolvedValue('ok') };
    trackFirstAckTimestamp(interaction, {});

    await expect(interaction.reply()).resolves.toBe('ok');
    expect(interaction.reply).not.toBe(vi.fn());
  });

  it('propagates a rejection without recording a timestamp', async () => {
    const interaction = { reply: vi.fn().mockRejectedValue(new Error('nope')) };
    const ackTiming: { ackedAt?: number } = {};
    trackFirstAckTimestamp(interaction, ackTiming);

    await expect(interaction.reply()).rejects.toThrow('nope');
    expect(ackTiming.ackedAt).toBeUndefined();
  });

  it('leaves methods that do not exist on the interaction alone', () => {
    const interaction = { customId: 'foo' };
    expect(() => trackFirstAckTimestamp(interaction, {})).not.toThrow();
  });
});
