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
}).openapi('Error', {
  example: { error: { code: 'commands.at.responses.hourRange', message: 'When a meridiem is not specified, hour must be a number between 0 and 23' } },
});

export const TelemetrySchema = z.object({
  executionNumber: z.number().int().openapi({ description: 'How many times the command has been run, across Discord and the API' }),
  command: z.string(),
  privacyPolicyUrl: z.string(),
  note: z.string().openapi({ description: 'The sentence the bot appends to its replies' }),
}).openapi('Telemetry', {
  example: {
    executionNumber: 1234,
    command: 'at',
    privacyPolicyUrl: 'https://hammertime.cyou/en/legal#telemetry-statistics',
    note: 'This is execution #1234 for the /at command (since we started counting). Thank you for contributing telemetry data, which helps the bot\'s future development.',
  },
});

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
}).openapi('Timestamp', {
  example: {
    command: 'at',
    unix: 1792773000,
    timezone: 'Europe/Budapest',
    header: '📅 2026-10-23 • 🕕 18:30:00 • 🌐 Europe/Budapest',
    content: '📅 2026-10-23 • 🕕 18:30:00 • 🌐 Europe/Budapest\n`<t:1792773000:d>` → **<t:1792773000:d>**\n`<t:1792773000:R>` → **<t:1792773000:R>**',
    singleFormat: null,
    minimalReply: false,
    usingAtHoursOnly: true,
    formats: [
      { format: 'd', timestamp: '<t:1792773000:d>' },
      { format: 'R', timestamp: '<t:1792773000:R>' },
    ],
    telemetry: {
      executionNumber: 1234,
      command: 'at',
      privacyPolicyUrl: 'https://hammertime.cyou/en/legal#telemetry-statistics',
      note: 'This is execution #1234 for the /at command (since we started counting). Thank you for contributing telemetry data, which helps the bot\'s future development.',
    },
  },
});

export type ErrorBody = z.infer<typeof ErrorSchema>;
export type TimestampBody = z.infer<typeof TimestampSchema>;

export const KeyInfoSchema = z.object({
  keyId: z.string(),
  kind: z.enum(['user', 'service']),
  discordUserId: z.string().openapi({ description: 'The Discord account the key acts as' }),
  scopes: z.array(z.string()),
}).openapi('KeyInfo', {
  example: { keyId: '42', kind: 'user', discordUserId: '140360880079503362', scopes: ['timestamps:create', 'settings:read', 'settings:write'] },
});

export const HealthSchema = z.object({ status: z.literal('ok') }).openapi('Health');
