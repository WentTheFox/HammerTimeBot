import { z } from '@hono/zod-openapi';

const FORMATS = ['d', 'D', 't', 'T', 'f', 'F', 's', 'S', 'R'] as const;
const COLUMNS = ['both', 'preview', 'syntax'] as const;

/** Mirrors the bot's SettingsValue: a null means the setting is not customised */
export const SettingsSchema = z.object({
  ephemeral: z.boolean().nullable().openapi({ description: 'Whether the bot replies are only visible to you (no effect on the API)' }),
  timezone: z.string().nullable().openapi({ description: 'Timezone used when a command does not specify one' }),
  header: z.boolean().nullable().openapi({ description: 'Whether replies start with the exact time as interpreted' }),
  boldPreview: z.boolean().nullable().openapi({ description: 'Whether previews are bold when listing all formats' }),
  columns: z.enum(COLUMNS).nullable().openapi({ description: 'Which columns replies show' }),
  format: z.enum(FORMATS).nullable().openapi({ description: 'Only return this format instead of all of them' }),
  formatMinimalReply: z.boolean().nullable().openapi({ description: 'With a single format, reply with just the preview' }),
  telemetry: z.boolean().nullable().openapi({ description: 'Whether anonymous command usage is recorded, and the run count shown in replies' }),
  defaultAtHour: z.number().int().nullable().openapi({ description: 'Hour (0-23) used by the at command when none is given' }),
  defaultAt12Hour: z.number().int().nullable().openapi({ description: 'Hour (1-12) used by the at12 and at commands when none is given' }),
  defaultAtMinute: z.number().int().nullable().openapi({ description: 'Minute used by the at commands when none is given' }),
  defaultAtSecond: z.number().int().nullable().openapi({ description: 'Second used by the at commands when none is given' }),
}).openapi('Settings');

/** Only the given settings change, a null resets one to its default. The backend does the final validation (e.g. known timezones). */
export const SettingsPatchSchema = z.object({
  ephemeral: z.boolean().nullable(),
  timezone: z.string().min(1).max(64).nullable(),
  header: z.boolean().nullable(),
  boldPreview: z.boolean().nullable(),
  columns: z.enum(COLUMNS).nullable(),
  format: z.enum(FORMATS).nullable(),
  formatMinimalReply: z.boolean().nullable(),
  telemetry: z.boolean().nullable(),
  defaultAtHour: z.number().int().min(0).max(23).nullable(),
  defaultAt12Hour: z.number().int().min(1).max(12).nullable(),
  defaultAtMinute: z.number().int().min(0).max(59).nullable(),
  defaultAtSecond: z.number().int().min(0).max(59).nullable(),
}).partial().openapi('SettingsPatch');

export type SettingsPatch = z.infer<typeof SettingsPatchSchema>;
