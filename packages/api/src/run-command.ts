import {
  CommandError,
  isCommandError,
  MessageTimestamp,
  mergeRenderOptions,
  MessageTimestampFormat,
  renderTimestamp,
  SettingsValue,
} from '@went.tf/hammertime-core';
import { Backend, RequestSource, TelemetryResponse } from './backend.js';
import { commandResolvers } from './commands.js';
import {
  CommandName,
  commandOptionTypes,
  errorMessages,
  telemetryMessages,
} from './generated/commands.js';
import { ErrorBody, TimestampBody } from './schemas.js';
import { interpolate } from './text.js';

export const commandErrorBody = ({ error, params }: CommandError): ErrorBody => ({
  error: { code: error, message: interpolate(errorMessages[error], params), ...(params ? { params } : {}) },
});

export type CommandRunResult =
  | { ok: true; body: TimestampBody }
  | { ok: false; status: 400; body: ErrorBody };

export interface RunCommandOptions {
  backend: Backend;
  name: CommandName;
  /** The validated request body / tool arguments, using the command's option names */
  input: Record<string, unknown>;
  discordUserId: string;
  source: RequestSource;
  nowMs: number;
  telemetryTimeoutMs: number;
}

const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T | null> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>(resolve => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

const telemetryNote = (telemetry: TelemetryResponse): string => [
  interpolate(telemetryMessages.telemetryInfoCount, {
    executionNumber: String(telemetry.executionNumber),
    command: `/${telemetry.commandName}`,
  }),
  interpolate(telemetryMessages.telemetryThankYou, {
    privacyPolicy: `[${telemetryMessages.privacyPolicyLink}](${telemetry.privacyPolicyUrl})`,
  }),
].join(' ');

/** Records the usage the way the bot does: only with consent, never fatal, and without holding the reply up for long */
const recordTelemetry = async (
  { backend, name, input, source, telemetryTimeoutMs }: RunCommandOptions,
  settings: SettingsValue,
): Promise<TelemetryResponse | null> => {
  if (!settings.telemetry) {
    return null;
  }
  const options = Object.keys(input)
    .filter(optionName => input[optionName] !== undefined && optionName in commandOptionTypes[name])
    .map(optionName => ({ name: optionName, type: commandOptionTypes[name][optionName] }));
  try {
    return await withTimeout(backend.recordTelemetry({ commandName: name, locale: 'en-US', source, options }), telemetryTimeoutMs);
  } catch {
    return null;
  }
};

/**
 * One command run, shared by the REST endpoints and the MCP tools: resolve the input with the account's
 * settings, render the reply like the bot does, and record the telemetry unless the account opted out.
 */
export const runCommand = async (options: RunCommandOptions): Promise<CommandRunResult> => {
  const { backend, name, input, discordUserId, nowMs } = options;
  const settings = await backend.getSettings(discordUserId);

  const resolved = commandResolvers[name](input as never, settings, nowMs);
  if (isCommandError(resolved)) {
    return { ok: false, status: 400, body: commandErrorBody(resolved) };
  }

  const rendered = renderTimestamp(
    resolved.date,
    resolved.timezone,
    mergeRenderOptions({
      columns: input.columns as string | undefined,
      format: input.format as string | undefined,
      header: input.header as boolean | undefined,
    }, settings),
    settings,
  );
  if (isCommandError(rendered)) {
    return { ok: false, status: 400, body: commandErrorBody(rendered) };
  }

  const telemetry = await recordTelemetry(options, settings);
  return {
    ok: true,
    body: {
      command: name,
      unix: rendered.unix,
      timezone: resolved.timezone ?? null,
      header: rendered.header,
      content: rendered.content,
      formats: rendered.formats.map((format: MessageTimestampFormat) => ({
        format,
        timestamp: MessageTimestamp.fromTimestamp(rendered.unix, format),
      })),
      ...(telemetry ? {
        telemetry: {
          executionNumber: telemetry.executionNumber,
          command: telemetry.commandName,
          privacyPolicyUrl: telemetry.privacyPolicyUrl,
          note: telemetryNote(telemetry),
        },
      } : {}),
    },
  };
};
