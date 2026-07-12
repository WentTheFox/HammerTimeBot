import { ApplicationCommandOptionType } from 'discord-api-types/v10';
import type { APIMessageComponent } from 'discord.js';
import { i18n, TFunction } from 'i18next';
import {
  NamedChatInputCommand,
  NamedComponent,
  NamedContextMenuCommand,
} from '@wentthefox-org/discord-bot-framework/interactions';
import { SettingsValue } from '../utils/settings.js';

import { ILogger } from './logger-types.js';

// Single declared source of truth for every valid command/component name -
// also used as the `name`/`id` field on each command/component object
// itself, which is what the framework's registries key off of.
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
  FAQ = 'faq',
}

export const enum BotMessageContextMenuCommandName {
  MESSAGE_SENT = 'Message Sent',
  MESSAGE_LAST_EDITED = 'Message Last Edited',
  EXTRACT_TIMESTAMPS = 'Extract Timestamps',
}

export const enum BotMessageComponentType {
  FORMAT_SELECT = 'format-select',
  APPROVE_PROPOSAL = 'approve-proposal',
  REJECT_PROPOSAL = 'reject-proposal',
}

export interface LoggerContext {
  logger: ILogger;
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

export type BotChatInputCommand = NamedChatInputCommand<UserInteractionContext, BotChatInputCommandName, TFunction>;

export type BotMessageContextMenuCommand = NamedContextMenuCommand<UserInteractionContext, BotMessageContextMenuCommandName, TFunction>;

export type BotMessageComponentDefinitionGetter = (t: TFunction, emojiIdMap: Record<string, string>, idSuffix?: string) => APIMessageComponent;

export type BotMessageComponent = NamedComponent<UserInteractionContext, BotMessageComponentType> & {
  getDefinition: BotMessageComponentDefinitionGetter;
};

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
