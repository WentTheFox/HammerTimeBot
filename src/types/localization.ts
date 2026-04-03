import { APIApplicationCommand, APIApplicationCommandOption } from 'discord-api-types/v10';
import {
  BotChatInputCommandName,
  BotMessageComponentType,
  BotMessageContextMenuCommandName,
} from './bot-interaction.js';
import { MessageTimestampFormat } from '../classes/message-timestamp.js';

export const enum GlobalCommandOptionName {
  COLUMNS = 'columns',
  EPHEMERAL = 'ephemeral',
  FORMAT = 'format',
  HEADER = 'header',
  TIMEZONE = 'timezone',
}

export const enum AtCommandOptionName {
  YEAR = 'year',
  MONTH = 'month',
  DATE = 'day',
  HOUR = 'hour',
  HOUR12 = 'hour12',
  MINUTE = 'minute',
  SECOND = 'second',
  AM = 'am',
  PM = 'pm',
}

export const enum At12CommandOptionName {
  YEAR = 'year',
  MONTH = 'month',
  DATE = 'day',
  HOUR = 'hour',
  MINUTE = 'minute',
  SECOND = 'second',
  AM = 'am',
  PM = 'pm',
}

export const enum InCommandOptionName {
  IN_YEARS = 'years',
  IN_MONTHS = 'months',
  IN_DAYS = 'days',
  IN_HOURS = 'hours',
  IN_MINUTES = 'minutes',
  IN_SECONDS = 'seconds',
}

export const enum AgoCommandOptionName {
  YEARS_AGO = 'years',
  MONTHS_AGO = 'months',
  DAYS_AGO = 'days',
  HOURS_AGO = 'hours',
  MINUTES_AGO = 'minutes',
  SECONDS_AGO = 'seconds',
}

export const enum AddCommandOptionName {
  TO = 'to',
  ADD_YEARS = 'years',
  ADD_MONTHS = 'months',
  ADD_DAYS = 'days',
  ADD_HOURS = 'hours',
  ADD_MINUTES = 'minutes',
  ADD_SECONDS = 'seconds',
}

export const enum SubtractCommandOptionName {
  FROM = 'from',
  SUBTRACT_YEARS = 'years',
  SUBTRACT_MONTHS = 'months',
  SUBTRACT_DAYS = 'days',
  SUBTRACT_HOURS = 'hours',
  SUBTRACT_MINUTES = 'minutes',
  SUBTRACT_SECONDS = 'seconds',
}

export const enum UnixCommandOptionName {
  VALUE = 'value',
}

export const enum ApiCommandOptionName {
  UPDATE_BOT_COMMANDS = 'update-bot-commands',
  UPDATE_BOT_TIMEZONES = 'update-bot-timezones',
}

export const enum IsoCommandOptionName {
  VALUE = 'value',
}

export const enum SnowflakeCommandOptionName {
  VALUE = 'value',
}

interface CommandOptionsMap {
  [BotChatInputCommandName.IN]: InCommandOptionName,
  [BotChatInputCommandName.AGO]: AgoCommandOptionName,
  [BotChatInputCommandName.AT]: AtCommandOptionName,
  [BotChatInputCommandName.ADD]: AddCommandOptionName,
  [BotChatInputCommandName.SUBTRACT]: SubtractCommandOptionName,
  [BotChatInputCommandName.UNIX]: UnixCommandOptionName,
  [BotChatInputCommandName.ISO]: IsoCommandOptionName,
  [BotChatInputCommandName.STATISTICS]: never,
  [BotChatInputCommandName.AT12]: At12CommandOptionName,
  [BotMessageContextMenuCommandName.MESSAGE_SENT]: never,
  [BotMessageContextMenuCommandName.MESSAGE_LAST_EDITED]: never,
}

export const enum GlobalCommandResponse {
  INVALID_DATE = 'invalidDate',
  NO_COMPONENTS_CURRENT_TIME = 'noComponentsCurrentTime',
  NO_COMPONENTS_UNIX = 'noComponentsUnix',
  TIMEZONE_NOT_FOUND = 'timezoneNotFound',
  UNEXPECTED_ERROR = 'unexpectedError',
  TELEMETRY_THANK_YOU = 'telemetryThankYou',
  TELEMETRY_INFO_COUNT = 'telemetryInfoCount',
  PRIVACY_POLICY_LINK = 'privacyPolicyLink',
}

export const enum SnowflakeCommandResponse {
  INVALID_SNOWFLAKE = 'invalidSnowflake',
}

export const enum IsoCommandResponse {
  INVALID_ISO_FORMAT = 'invalidIsoFormat',
}

export const enum MessageSentCommandResponse {
  TARGET_MESSAGE = 'targetMessage',
}

export const enum MessageLastEditedCommandResponse {
  TARGET_MESSAGE = 'targetMessage',
  NOT_EDITED = 'notEdited',
}

export const enum ExtractTimestampsCommandResponse {
  TARGET_MESSAGE = 'targetMessage',
  NO_TIMESTAMPS = 'noTimestamps',
}

export const enum At12CommandResponse {
  AM_OR_PM_ONLY = 'amOrPmOnly',
}

interface CommandResponsesMap {
  global: GlobalCommandResponse,
  [BotChatInputCommandName.IN]: never,
  [BotChatInputCommandName.AGO]: never,
  [BotChatInputCommandName.AT]: never,
  [BotChatInputCommandName.ADD]: never,
  [BotChatInputCommandName.SUBTRACT]: never,
  [BotChatInputCommandName.UNIX]: never,
  [BotChatInputCommandName.ISO]: IsoCommandResponse,
  [BotChatInputCommandName.STATISTICS]: never,
  [BotChatInputCommandName.SNOWFLAKE]: SnowflakeCommandResponse,
  [BotChatInputCommandName.AT12]: At12CommandResponse,
  [BotMessageContextMenuCommandName.MESSAGE_SENT]: MessageSentCommandResponse,
  [BotMessageContextMenuCommandName.MESSAGE_LAST_EDITED]: MessageLastEditedCommandResponse,
  [BotMessageContextMenuCommandName.EXTRACT_TIMESTAMPS]: ExtractTimestampsCommandResponse,
}

interface ComponentsMap {
  global: [BotMessageComponentType.FORMAT_SELECT],
  [BotChatInputCommandName.SETTINGS]: ['openSettingsButton'],
}

export const enum ResponseColumnChoices {
  SYNTAX_ONLY = 'syntax',
  PREVIEW_ONLY = 'preview',
  BOTH = 'both',
}

interface OptionChoicesMap {
  [GlobalCommandOptionName.COLUMNS]: ResponseColumnChoices,
  [GlobalCommandOptionName.FORMAT]: MessageTimestampFormat,
}

export type OptionLocalization<OptionName extends string = string> =
  Pick<APIApplicationCommandOption, 'name' | 'description'>
  & (OptionName extends keyof OptionChoicesMap ? {
    choices: Record<OptionChoicesMap[OptionName], string>
  } : { choices?: Record<string, never> });

export type ResponsesLocalization<CommandKey extends keyof CommandResponsesMap> = CommandResponsesMap[CommandKey] extends never ? unknown : {
  responses: { [l in CommandResponsesMap[CommandKey]]: string };
};

export type CommandLocalization<CommandKey extends keyof CommandOptionsMap & keyof CommandResponsesMap = keyof CommandOptionsMap & keyof CommandResponsesMap> =
  Pick<APIApplicationCommand, CommandKey extends BotMessageContextMenuCommandName ? 'name' : ('name' | 'description')>
  & (
    CommandKey extends BotMessageContextMenuCommandName
      ? ResponsesLocalization<CommandKey>
      : ({
        options: { [l in CommandOptionsMap[CommandKey]]: OptionLocalization<l> };
      } & ResponsesLocalization<CommandKey>)
  )
  & (
    CommandKey extends keyof ComponentsMap
      ? { components: Record<ComponentsMap[CommandKey][number], string> }
      : { components?: undefined }
  );

export type Localization = {
  commands: {
    [k in keyof CommandOptionsMap & keyof CommandResponsesMap]: CommandLocalization<k>;
  };
};
