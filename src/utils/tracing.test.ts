import { describe, expect, it } from 'vitest';
import { componentNameFromCustomId, routeFromApiPath, withBackendRequestSpan, withInteractionSpan } from './tracing.js';

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

describe('routeFromApiPath', () => {
  it('keeps only the static leading segment, never an id', () => {
    expect(routeFromApiPath('/settings/1139018530776436856')).toBe('settings');
    expect(routeFromApiPath('commands')).toBe('commands');
    expect(routeFromApiPath('/')).toBe('unknown');
  });
});

describe('withBackendRequestSpan', () => {
  const info = { method: 'GET', route: 'settings', attempt: 1 };

  it('returns the result and hands out (empty) trace headers when tracing is not configured', async () => {
    const result = await withBackendRequestSpan(info, async ({ headers, setStatus }) => {
      setStatus(200);
      return headers;
    });
    expect(result).toEqual({});
  });

  it('rethrows the original error', async () => {
    const error = new Error('Request timed out after 1000ms');
    await expect(withBackendRequestSpan(info, async () => { throw error; })).rejects.toBe(error);
  });
});
