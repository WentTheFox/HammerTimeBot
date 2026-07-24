import { createLogger } from '@went.tf/discord-bot-framework/logger';
import { env } from '../env.js';
import { ILogger } from '../types/logger-types.js';

/**
 * Builds the bot's root logger: always logs to the console, and additionally fans
 * warn/error/fatal records out to a Discord webhook when one is configured.
 */
export const createAppLogger = (prefix: string | string[]): ILogger => createLogger({
  prefix,
  discordWebhook: env.DISCORD_LOG_WEBHOOK_URL
    ? { url: env.DISCORD_LOG_WEBHOOK_URL }
    : undefined,
});
