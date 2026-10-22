import { TZDate } from '@date-fns/tz';
import { isValid } from 'date-fns';
import { CommandError } from './resolvers.js';
import { getExactTimePrefix } from './get-exact-time-prefix.js';
import { MessageTimestamp, MessageTimestampFormat } from './message-timestamp.js';
import { ResponseColumnChoices, SettingsValue } from './settings.js';
import { formattedResponse, supportedFormats } from './time.js';

/**
 * Display options, already resolved from the command option, the user setting and the default (in that
 * order), see {@link mergeRenderOptions}. `null` means "use the default".
 */
export interface RenderOptions {
  columns: string | null;
  format: string | null;
  header: boolean | null;
}

type RenderSettings = Pick<SettingsValue, 'boldPreview' | 'formatMinimalReply'>;

export interface RenderedTimestamp {
  /** Complete reply text, header included */
  content: string;
  /** Exact-time header line, null when omitted */
  header: string | null;
  /** The syntax/preview rows */
  table: string;
  formats: MessageTimestampFormat[];
  /** The single requested format, null when all formats are listed */
  singleFormat: MessageTimestampFormat | null;
  /** Single format with the minimal-reply setting on, meaning only the preview is shown */
  minimalReply: boolean;
  columns: ResponseColumnChoices;
  unix: number;
}

/** Applies the precedence the bot uses: command option, then user setting, then default */
export const mergeRenderOptions = (
  options: Partial<RenderOptions> | undefined,
  settings: Pick<SettingsValue, 'columns' | 'format' | 'header'> | undefined,
): RenderOptions => ({
  columns: options?.columns ?? settings?.columns ?? ResponseColumnChoices.BOTH,
  format: options?.format ?? settings?.format ?? null,
  header: options?.header ?? settings?.header ?? true,
});

export const renderTimestamp = (
  date: TZDate,
  timezone: string | undefined,
  options: RenderOptions,
  settings: RenderSettings | undefined,
): RenderedTimestamp | CommandError => {
  if (!isValid(date)) {
    return { error: 'commands.global.responses.invalidDate' };
  }

  const ts = new MessageTimestamp(date);
  const singleFormat = MessageTimestamp.isValidFormat(options.format) ? options.format : null;
  const formats = singleFormat ? [singleFormat] : supportedFormats;
  const minimalReply = Boolean(singleFormat && settings?.formatMinimalReply);

  const columns = minimalReply
    ? ResponseColumnChoices.PREVIEW_ONLY
    : (options.columns ?? ResponseColumnChoices.BOTH) as ResponseColumnChoices;
  const addHeader = !minimalReply && (options.header ?? true);
  const header = addHeader ? getExactTimePrefix(date, timezone ?? 'UTC') : null;
  const table = formattedResponse(ts, formats, columns, !singleFormat && (settings?.boldPreview ?? null));

  return {
    content: `${header ? `${header}\n` : ''}${table}`,
    header,
    table,
    formats,
    singleFormat,
    minimalReply,
    columns,
    unix: ts.getUnixSeconds(),
  };
};
