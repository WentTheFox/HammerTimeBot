import type {
  APIMessageComponent,
  AutocompleteInteraction,
  BaseInteraction,
  ChatInputCommandInteraction,
  MessageComponentInteraction,
  RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from 'discord.js';
import { MessageContextMenuCommandInteraction } from 'discord.js';
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord-api-types/v10';
import { i18n, TFunction } from 'i18next';

import { NestableLogger } from './logger-types.js';
import { SettingsValue } from '../utils/settings.js';

export const enum BotChatInputCommandName {
  ADD = 'add',
  AGO = 'ago',
  AT = 'at',
  IN = 'in',
  ISO = 'iso',
  SNOWFLAKE = 'snowflake',
  STATISTICS = 'statistics',
  SUBTRACT = 'subtract',
  UNIX = 'unix',
  SETTINGS = 'settings',
  API = 'api',
  AT12 = 'at12',
}

export const enum BotMessageContextMenuCommandName {
  MESSAGE_SENT = 'Message Sent',
  MESSAGE_LAST_EDITED = 'Message Last Edited',
  EXTRACT_TIMESTAMPS = 'Extract Timestamps',
}

export const enum BotMessageComponentCustomId {
  FORMAT_SELECT = 'format-select',
}

export interface LoggerContext {
  logger: NestableLogger;
}
export interface UserSettingsContext {
  getSettings: () => Promise<SettingsValue>;
}

export interface InteractionHandlerContext extends LoggerContext {
  i18next: i18n;
  emojiIdMap: Record<string, string>;
  commandIdMap: Record<string, string | undefined>;
}

export interface InteractionContext extends Omit<InteractionHandlerContext, 'i18next'> {
  t: TFunction;
}

export type UserInteractionContext = InteractionContext & UserSettingsContext;

export type InteractionHandler<T extends BaseInteraction> = (
  interaction: T,
  context: UserInteractionContext
) => void | Promise<void>;

export interface BotChatInputCommand {
  registerCondition?: () => boolean;
  getDefinition: (t: TFunction) => RESTPostAPIChatInputApplicationCommandsJSONBody;
  handle: InteractionHandler<ChatInputCommandInteraction & { commandName: BotChatInputCommandName }>;
  autocomplete?: InteractionHandler<AutocompleteInteraction & { commandName: BotChatInputCommandName }>;
}

export interface BotMessageContextMenuCommand {
  getDefinition: (t: TFunction) => Omit<RESTPostAPIContextMenuApplicationCommandsJSONBody, 'type'> & {
    type: ApplicationCommandType.Message
  };
  handle: InteractionHandler<MessageContextMenuCommandInteraction & { commandName: BotMessageContextMenuCommandName }>;
}

export interface BotMessageComponent {
  getDefinition: (t: TFunction, emojiIdMap: Record<string, string>) => APIMessageComponent;
  handle: InteractionHandler<MessageComponentInteraction & { customId: BotMessageComponentCustomId }>;
}

export interface IntegerOptionMetadata {
  type: ApplicationCommandOptionType.Integer;
  min_value?: number;
  max_value?: number;
}

export interface NumberOptionMetadata {
  type: ApplicationCommandOptionType.Number;
  min_value?: number;
  max_value?: number;
}


export interface StringOptionMetadata {
  type: ApplicationCommandOptionType.String;
  min_length?: number;
  max_length?: number;
  autocomplete?: boolean;
}
