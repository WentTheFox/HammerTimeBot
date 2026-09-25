import { describe, expect, it, vi } from 'vitest';
import { ApplicationCommandType } from 'discord-api-types/v10';
import { BotCommands } from './update-guild-commands.js';

vi.mock('./update-guild-commands.js', () => ({}));
vi.mock('./backend-api-data-updaters.js', () => ({}));
vi.mock('./rest.js', () => ({}));

const { getCommandsHash, isGlobalCommandsUpdateNeeded } = await import('./sync-global-commands.js');

const body = [
  { name: 'at', description: 'At', type: ApplicationCommandType.ChatInput },
  { name: 'Find timestamps', type: ApplicationCommandType.Message },
] as BotCommands;
const hash = getCommandsHash('app-1', body);

describe('getCommandsHash', () => {
  it('changes with the body and the application', () => {
    expect(getCommandsHash('app-1', body)).toBe(hash);
    expect(getCommandsHash('app-2', body)).not.toBe(hash);
    expect(getCommandsHash('app-1', [{ ...body[0], description: 'Changed' }, body[1]] as BotCommands)).not.toBe(hash);
  });
});

describe('isGlobalCommandsUpdateNeeded', () => {
  const registered = [
    { name: 'Find timestamps', type: ApplicationCommandType.Message },
    { name: 'at', type: ApplicationCommandType.ChatInput },
  ];

  it('skips when the hash matches and the same commands are registered', () => {
    expect(isGlobalCommandsUpdateNeeded({ storedHash: hash, hash, registered, body })).toBe(false);
  });

  it('updates when nothing has been synced from this worktree yet', () => {
    expect(isGlobalCommandsUpdateNeeded({ storedHash: undefined, hash, registered, body })).toBe(true);
  });

  it('updates when the body changed', () => {
    expect(isGlobalCommandsUpdateNeeded({ storedHash: 'old', hash, registered, body })).toBe(true);
  });

  it('updates when the registered commands were changed from elsewhere', () => {
    expect(isGlobalCommandsUpdateNeeded({ storedHash: hash, hash, registered: [], body })).toBe(true);
    expect(isGlobalCommandsUpdateNeeded({ storedHash: hash, hash, registered: registered.slice(1), body })).toBe(true);
  });
});
