import { MessageTimestampFormat } from './message-timestamp.js';

export const SettingName = {
  ephemeral: 'ephemeral',
  timezone: 'timezone',
  header: 'header',
  boldPreview: 'boldPreview',
  columns: 'columns',
  format: 'format',
  formatMinimalReply: 'formatMinimalReply',
  telemetry: 'telemetry',
  defaultAtHour: 'defaultAtHour',
  defaultAt12Hour: 'defaultAt12Hour',
  defaultAtMinute: 'defaultAtMinute',
  defaultAtSecond: 'defaultAtSecond',
} as const;

export type SettingName = typeof SettingName[keyof typeof SettingName];

export enum ResponseColumnChoices {
  SYNTAX_ONLY = 'syntax',
  PREVIEW_ONLY = 'preview',
  BOTH = 'both',
}

export interface SettingsValue {
  [SettingName.ephemeral]: boolean | null;
  [SettingName.timezone]: string | null;
  [SettingName.header]: boolean | null,
  [SettingName.boldPreview]: boolean | null,
  [SettingName.columns]: ResponseColumnChoices | null,
  [SettingName.format]: MessageTimestampFormat | null,
  [SettingName.formatMinimalReply]: boolean | null,
  [SettingName.telemetry]: boolean | null,
  [SettingName.defaultAtHour]: number | null,
  [SettingName.defaultAt12Hour]: number | null,
  [SettingName.defaultAtMinute]: number | null,
  [SettingName.defaultAtSecond]: number | null,
}

export const defaultSettings: { [k in SettingName]: SettingsValue[k] } = {
  [SettingName.ephemeral]: null,
  [SettingName.timezone]: null,
  [SettingName.header]: null,
  [SettingName.boldPreview]: null,
  [SettingName.columns]: null,
  [SettingName.format]: null,
  [SettingName.formatMinimalReply]: null,
  [SettingName.defaultAtHour]: null,
  [SettingName.defaultAt12Hour]: null,
  [SettingName.defaultAtMinute]: null,
  [SettingName.defaultAtSecond]: 0,
  [SettingName.telemetry]: true,
};
