import { describe, expect, it } from 'vitest';
import { componentNameFromCustomId, withInteractionSpan } from './tracing.js';

describe('componentNameFromCustomId', () => {
  it('keeps only the leading identifier, not data after a separator', () => {
    expect(componentNameFromCustomId('format-select:123456789012345678')).toBe('format-select');
    expect(componentNameFromCustomId('approveProposal')).toBe('approveProposal');
  });

  it('falls back for ids that do not start like an identifier', () => {
    expect(componentNameFromCustomId('')).toBe('unknown');
    expect(componentNameFromCustomId(':oops')).toBe('unknown');
  });
});

describe('withInteractionSpan', () => {
  it('returns the result and rethrows errors when tracing is not configured', async () => {
    const timing = { receivedAt: Date.now() };
    await expect(withInteractionSpan({ kind: 'Command', name: 'unix' }, timing, async () => 42)).resolves.toBe(42);
    await expect(withInteractionSpan({ kind: 'Command' }, timing, async () => { throw new Error('boom'); })).rejects.toThrow('boom');
  });
});
