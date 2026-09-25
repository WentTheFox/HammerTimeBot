import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { RESTGetAPIApplicationCommandsResult, Routes } from 'discord-api-types/v10';
import { env } from '../env.js';
import { InteractionContext } from '../types/bot-interaction.js';
import { updateBotCommandsInApi } from './backend-api-data-updaters.js';
import { rest } from './rest.js';
import { BotCommands, buildCommandsBody, createRegistrar } from './update-guild-commands.js';

/**
 * Hash of the last command body Discord accepted, kept next to sync-commands.log in the worktree
 * (gitignored, and the deploy hook's `checkout -f` leaves ignored files alone). npm scripts always
 * run from the package root, which is what makes process.cwd() the worktree here.
 */
const SYNC_STATE_PATH = resolve(process.cwd(), '.command-sync-state.json');

interface CommandSyncState {
  hash: string;
}

export const getCommandsHash = (applicationId: string, body: BotCommands): string =>
  createHash('sha256').update(JSON.stringify({ applicationId, body })).digest('hex');

const commandKeys = (commands: Array<{ name: string, type?: number }>): string =>
  commands.map(({ name, type }) => `${type ?? 1}:${name}`).sort().join('\n');

/**
 * The stored hash only proves what this worktree last sent, so the commands actually registered on
 * Discord are also checked by name/type - that catches them having been changed from elsewhere
 * (e.g. cleaned out by a local-mode run against the same application) without having to normalize
 * Discord's response down to exactly what was sent.
 */
export const isGlobalCommandsUpdateNeeded = (params: {
  storedHash: string | undefined,
  hash: string,
  registered: Array<{ name: string, type?: number }>,
  body: BotCommands,
}): boolean => params.storedHash !== params.hash || commandKeys(params.registered) !== commandKeys(params.body);

const readStoredHash = async (): Promise<string | undefined> => {
  try {
    const state = JSON.parse(await readFile(SYNC_STATE_PATH, 'utf8')) as Partial<CommandSyncState>;
    return typeof state.hash === 'string' ? state.hash : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The deploy-time counterpart of updateGlobalCommands: skips Discord's bulk overwrite entirely when
 * the command body hasn't changed since the last successful one (most deploys), since that request
 * is slow and times out regularly. The backend's copy of the commands is refreshed either way, from
 * whichever list is now current on Discord.
 */
export const syncGlobalCommands = async (context: InteractionContext, { force = false } = {}): Promise<void> => {
  const logger = context.logger.nest('syncGlobalCommands');
  const body = buildCommandsBody(context.t);
  const hash = getCommandsHash(env.DISCORD_CLIENT_ID, body);
  const registered = await rest.get(Routes.applicationCommands(env.DISCORD_CLIENT_ID)) as RESTGetAPIApplicationCommandsResult;

  if (!force && !isGlobalCommandsUpdateNeeded({ storedHash: await readStoredHash(), hash, registered, body })) {
    logger.log(`Commands unchanged since the last successful update (${hash.slice(0, 12)}), skipping`);
    await updateBotCommandsInApi(context, body, registered);
    return;
  }

  logger.log(force ? 'Forced update' : 'Commands changed, updating');
  const result = await createRegistrar(logger).updateGlobalCommands(body);
  const state: CommandSyncState = { hash };
  await writeFile(SYNC_STATE_PATH, `${JSON.stringify(state)}\n`);
  await updateBotCommandsInApi(context, body, result);
};
