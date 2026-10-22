import { CommandError, commandErrorKeys, CommandErrorKey } from '@went.tf/hammertime-core';
import { z } from 'zod';
import { env } from '../env.js';
import { ILogger } from '../types/logger-types.js';

const timestampSchema = z.object({
  command: z.string(),
  unix: z.number(),
  timezone: z.string().nullable(),
  header: z.string().nullable(),
  content: z.string(),
  singleFormat: z.string().nullable(),
  minimalReply: z.boolean(),
  usingAtHoursOnly: z.boolean().optional(),
  telemetry: z.object({
    executionNumber: z.number(),
    command: z.string(),
    privacyPolicyUrl: z.string(),
  }).optional(),
});

const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    params: z.record(z.string(), z.string()).optional(),
  }),
});

export type CommandsApiTimestamp = z.infer<typeof timestampSchema>;

export type CommandsApiResult =
  /** The API resolved the command and recorded the run (unless the account opted out of telemetry) */
  | { type: 'timestamp'; body: CommandsApiTimestamp }
  /** The API understood the command and rejected the input, for a reason the bot has a message for */
  | { type: 'rejected'; error: CommandError };

export interface CommandsApiClient {
  /**
   * Runs a command through the API as the given Discord account. Null whenever the API did not give an answer the bot
   * can use (it is down, slow, refused the bot, limited it, or answered something unexpected), in which case the
   * caller handles the command itself.
   */
  run: (logger: ILogger, discordUserId: string, command: string, options: Record<string, unknown>) => Promise<CommandsApiResult | null>;
}

export interface CommandsApiClientOptions {
  url: string;
  key: string;
  timeoutMs: number;
  /** Injectable for tests */
  fetch?: typeof fetch;
}

const knownErrorKeys: ReadonlySet<string> = new Set(commandErrorKeys);

/** Null when no API is configured */
export const createCommandsApiClient = ({ url, key, timeoutMs, fetch: fetchImpl = fetch }: CommandsApiClientOptions): CommandsApiClient | null => {
  if (!url || !key) {
    return null;
  }
  const baseUrl = url.replace(/\/+$/, '');

  return {
    async run(logger, discordUserId, command, options) {
      const startedAt = Date.now();
      const fallback = (reason: string): null => {
        logger.warn(`Handling /${command} here instead of through the API: ${reason} (after ${Date.now() - startedAt}ms)`);
        return null;
      };

      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/${encodeURIComponent(command)}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'X-Discord-User-Id': discordUserId,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(options),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        return fallback(error instanceof Error && error.name === 'TimeoutError' ? `no answer within ${timeoutMs}ms` : `request failed (${String(error)})`);
      }

      const json: unknown = await response.json().catch(() => undefined);
      if (response.status === 200) {
        const parsed = timestampSchema.safeParse(json);
        return parsed.success ? { type: 'timestamp', body: parsed.data } : fallback('unexpected response');
      }
      if (response.status === 400) {
        const parsed = errorSchema.safeParse(json);
        if (parsed.success && knownErrorKeys.has(parsed.data.error.code)) {
          const { code, params } = parsed.data.error;
          return { type: 'rejected', error: { error: code as CommandErrorKey, ...(params ? { params } : {}) } };
        }
      }

      return fallback(`HTTP ${response.status}`);
    },
  };
};

export const commandsApi: CommandsApiClient | null = createCommandsApiClient({
  url: env.COMMANDS_API_URL,
  key: env.COMMANDS_API_KEY,
  timeoutMs: env.COMMANDS_API_TIMEOUT_MS,
});
