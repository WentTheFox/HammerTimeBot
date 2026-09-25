import { REST } from '@discordjs/rest';
import { env } from '../env.js';

export const rest = new REST({
  version: '10',
  userAgentAppendix: env.UA_STRING,
}).setToken(env.DISCORD_BOT_TOKEN);

/**
 * For bulk command overwrites only: Discord regularly takes well over @discordjs/rest's 15s default
 * to process PUT /applications/{id}/commands (seen 8s-105s in production), and retrying an aborted
 * attempt just restarts that same slow operation on Discord's side - with the default 3 retries, 4
 * attempts could each time out and fail the whole sync after ~90s. One long attempt instead; a
 * failure is picked up by the next deploy's sync, since nothing is recorded as synced until it works.
 */
export const commandRegistrationRest = new REST({
  version: '10',
  userAgentAppendix: env.UA_STRING,
  timeout: 120_000,
  retries: 0,
}).setToken(env.DISCORD_BOT_TOKEN);
