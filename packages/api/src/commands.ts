import type { z } from '@hono/zod-openapi';
import {
  CommandResult,
  resolveAdd,
  resolveAgo,
  resolveAt,
  resolveAt12,
  resolveIn,
  resolveIso,
  resolveSnowflake,
  resolveSubtract,
  resolveUnix,
  SettingsValue,
} from '@went.tf/hammertime-core';
import type { CommandName, commandRequestSchemas } from './generated/commands.js';

type CommandInput<N extends CommandName> = z.infer<(typeof commandRequestSchemas)[N]>;

/**
 * Connects each generated command to its resolver in the core package. The mapped type makes the compiler
 * fail when a command is added to commands.json without being handled here (and the other way around).
 */
export const commandResolvers = {
  add: (input) => resolveAdd(input),
  ago: (input, _settings, nowMs) => resolveAgo(input, nowMs),
  at: (input, settings, nowMs) => resolveAt(input, settings, nowMs),
  at12: (input, settings, nowMs) => resolveAt12(input, settings, nowMs),
  in: (input, _settings, nowMs) => resolveIn(input, nowMs),
  iso: (input, settings) => resolveIso(input, settings),
  snowflake: (input) => resolveSnowflake(input),
  subtract: (input) => resolveSubtract(input),
  unix: (input) => resolveUnix(input),
} satisfies { [N in CommandName]: (input: CommandInput<N>, settings: SettingsValue, nowMs: number) => CommandResult };
