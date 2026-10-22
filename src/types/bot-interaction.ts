import type { APIMessageComponent } from 'discord.js';
import { i18n, TFunction } from 'i18next';
import {
  NamedChatInputCommand,
  NamedComponent,
  NamedContextMenuCommand,
} from '@went.tf/discord-bot-framework/interactions';
import { SettingsValue } from '../utils/settings.js';

import { ILogger } from './logger-types.js';

// Chat-input/context-menu command names are declared exactly twice: as the
// `name` field on each command's commands.json entry, and as the `name`/`id`
// field on its registry object here (both must already agree - the framework
// throws at build time otherwise). Nothing else defines them again; consumers
// that need the full name union (e.g. types/localization.ts) derive it via
// `RegistryName<typeof chatInputCommandRegistry>` in utils/interactions/registries.ts.
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
  /** True in src/webhook.ts (no gateway/shard connection at all), false in src/bot.ts. */
  isWebhookMode: boolean;
}

export interface InteractionContext extends Omit<InteractionHandlerContext, 'i18next'> {
  t: TFunction;
}

export type UserInteractionContext = InteractionContext & UserSettingsContext & {
  /**
   * Set by a command that the API handled: the API already recorded the run, and its note is part of the reply, so
   * this process must not record it again
   */
  commandRecordedByApi?: boolean;
};

export type BotChatInputCommand = NamedChatInputCommand<UserInteractionContext>;

export type BotMessageContextMenuCommand = NamedContextMenuCommand<UserInteractionContext>;

export type BotMessageComponentDefinitionGetter = (t: TFunction, emojiIdMap: Record<string, string>, idSuffix?: string) => APIMessageComponent;

export type BotMessageComponent = NamedComponent<UserInteractionContext, BotMessageComponentType> & {
  getDefinition: BotMessageComponentDefinitionGetter;
};
