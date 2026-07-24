import { boolFromString, defineEnv } from '@went.tf/discord-bot-framework/env';
import { z } from 'zod';

/**
 * Type-safe process.env
 */
export const env = defineEnv({
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  CROWDIN_PROJECT_IDENTIFIER: z.string().optional().default(''),
  LOCAL: boolFromString().default(false),
  DEBUG_I18N: boolFromString().default(false),
  DISABLE_SETTINGS: boolFromString().default(false),
  UA_STRING: z.string().min(1),
  DISCORD_INVITE_URL: z.string().min(1),
  API_URL: z.string().min(1),
  API_TOKEN: z.string().min(1),
  /** Server ID used to resolve role mentions in FAQ entries. Optional. */
  SUPPORT_SERVER_ID: z.string().optional().default(''),
  /** Discord webhook URL logs of warn level and above are fanned out to. Optional. */
  DISCORD_LOG_WEBHOOK_URL: z.string().optional().default(''),
});
