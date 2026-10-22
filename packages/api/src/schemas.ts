import { z } from '@hono/zod-openapi';
import { commandNames } from './generated/commands.js';

export const ErrorSchema = z.object({
  error: z.object({
    code: z.string().openapi({
      description: 'Machine-readable reason. For rejected command input this is the bot\'s locale key, e.g. commands.at.responses.hourRange',
    }),
    message: z.string().openapi({ description: 'English explanation, the same text the Discord bot replies with' }),
    params: z.record(z.string(), z.string()).optional().openapi({ description: 'Values interpolated into the message' }),
    issues: z.array(z.object({ path: z.string(), message: z.string() })).optional().openapi({
      description: 'For invalid_request: what is wrong with which field',
    }),
  }),
}).openapi('Error');

export const TelemetrySchema = z.object({
  executionNumber: z.number().int().openapi({ description: 'How many times the command has been run, across Discord and the API' }),
  command: z.string(),
  privacyPolicyUrl: z.string(),
  note: z.string().openapi({ description: 'The sentence the bot appends to its replies' }),
}).openapi('Telemetry');

export const TimestampSchema = z.object({
  command: z.enum(commandNames),
  unix: z.number().int().openapi({ description: 'UNIX timestamp in seconds' }),
  timezone: z.string().nullable().openapi({ description: 'The timezone the input was interpreted in, null for commands that have none' }),
  header: z.string().nullable().openapi({ description: 'The exact time as interpreted, null when the header is turned off' }),
  content: z.string().openapi({ description: 'The reply the bot would send: the optional header and the syntax/preview rows' }),
  singleFormat: z.string().nullable().openapi({ description: 'The one format that was asked for (by option or setting), null when every format is listed' }),
  minimalReply: z.boolean().openapi({
    description: 'True when only the preview of a single format is meant to be shown, which the formatMinimalReply setting asks for',
  }),
  usingAtHoursOnly: z.boolean().optional().openapi({
    description: 'Only for at: the hour was given as a bare 24-hour value, which the at12 command or a meridiem makes unambiguous',
  }),
  formats: z.array(z.object({
    format: z.string().openapi({ description: 'Discord timestamp style (d, D, t, T, f, F, s, S or R)' }),
    timestamp: z.string().openapi({ description: 'Markdown to paste into Discord, e.g. <t:1650802953:R>' }),
  })),
  telemetry: TelemetrySchema.optional().openapi({
    description: 'Present only when usage telemetry is enabled in the settings of the account the key acts as',
  }),
}).openapi('Timestamp');

export type ErrorBody = z.infer<typeof ErrorSchema>;
export type TimestampBody = z.infer<typeof TimestampSchema>;

export const KeyInfoSchema = z.object({
  keyId: z.string(),
  kind: z.enum(['user', 'service']),
  discordUserId: z.string().openapi({ description: 'The Discord account the key acts as' }),
  scopes: z.array(z.string()),
}).openapi('KeyInfo');

export const HealthSchema = z.object({ status: z.literal('ok') }).openapi('Health');
