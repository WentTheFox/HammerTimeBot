import {
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  CommandInteraction,
  ComponentType,
  ContextMenuCommandInteraction,
  DiscordjsError,
  DiscordjsErrorCodes,
  InteractionType,
  MessageComponentInteraction,
  MessageContextMenuCommandInteraction,
} from 'discord.js';
import { chatInputCommandMap, isKnownChatInputCommandInteraction } from './interactions/chat-input-commands.js';
import { EmojiCharacters } from '../constants/emoji-characters.js';
import {
  getUserIdentifier,
  isEphemeralResponse,
  stringifyChannelName,
  stringifyGuildName,
  stringifyOptionsData,
} from './messaging.js';
import { ApplicationCommandType, MessageFlags } from 'discord-api-types/v10';
import { DEFAULT_LANGUAGE } from '../constants/locales.js';
import {
  isKnownMessageContextmenuInteraction,
  messageContextMenuCommandMap,
} from './interactions/message-context-menu-commands.js';
import { getSettings, SettingsValue } from './settings.js';
import { InteractionHandlerContext, LoggerContext, UserInteractionContext } from '../types/bot-interaction.js';
import { TFunction } from 'i18next';
import { isKnownMessageComponentInteraction, messageComponentMap } from './interactions/message-components.js';
import { interactionReply } from './interaction-reply.js';
import { sendCommandTelemetry } from './backend-api-data-updaters.js';
import { addTelemetryNoteToReply } from './add-telemetry-note-to-reply.js';

const ellipsis = '…';

const processingErrorMessageFactory = (t: TFunction): string => `${EmojiCharacters.OCTAGONAL_SIGN} ${t('commands.global.responses.unexpectedError')}`;

const handleInteractionError = async (interaction: ChatInputCommandInteraction | ButtonInteraction | AutocompleteInteraction | ContextMenuCommandInteraction | MessageComponentInteraction, context: UserInteractionContext) => {
  if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
    await interaction.respond([
      {
        value: '',
        name: processingErrorMessageFactory(context.t),
      },
    ]);
    return;
  }

  let alreadyReplied = interaction.replied;
  if (!alreadyReplied) {
    try {
      await interactionReply(context, interaction, {
        content: processingErrorMessageFactory(context.t),
        flags: MessageFlags.Ephemeral,
      });
    } catch (e) {
      if (e instanceof DiscordjsError && e.code === DiscordjsErrorCodes.InteractionAlreadyReplied) {
        alreadyReplied = true;
      } else {
        throw e;
      }
    }
  }
  if (!alreadyReplied) {
    return;
  }
  // If we already replied, we need to do some editing on the existing message to include the error
  const oldReply = await interaction.fetchReply();
  const flags = oldReply.flags.bitfield;
  const processingErrorMessage = processingErrorMessageFactory(context.t);
  const oldReplyComponents = oldReply.components;
  if (oldReply.flags.has(MessageFlags.IsComponentsV2)) {
    await interaction.editReply({
      flags,
      components: [...oldReplyComponents, {
        type: ComponentType.TextDisplay,
        content: processingErrorMessage,
      }],
    });
    return;
  }
  const oldReplyContent = oldReply.content;
  const messageSuffix = `\n\n${processingErrorMessage}`;
  let newContent = oldReplyContent + messageSuffix;
  const maximumMessageLength = 2000;
  if (newContent.length > maximumMessageLength) {
    newContent = oldReplyContent.substring(0, maximumMessageLength - messageSuffix.length - ellipsis.length) + ellipsis + messageSuffix;
  }
  await interaction.editReply({
    flags,
    content: newContent,
  });
};

const isChatInputCommandInteraction = (interaction: CommandInteraction): interaction is ChatInputCommandInteraction => {
  return interaction.commandType === ApplicationCommandType.ChatInput;
};

interface CreateTFunctionOptions {
  i18next: InteractionHandlerContext['i18next'];
  ephemeral: boolean | null;
  locale: string;
  guild: { preferredLocale?: string } | undefined | null;
}

const createTFunction = ({ i18next, ephemeral, locale, guild }: CreateTFunctionOptions) => {
  return i18next.getFixedT(
    // Always use user's locale for ephemeral responses, otherwise use server's preferred locale when available
    ephemeral
      ? [locale, DEFAULT_LANGUAGE] :
      (
        guild?.preferredLocale
          ? [guild.preferredLocale, DEFAULT_LANGUAGE]
          : DEFAULT_LANGUAGE
      ),
  );
};

export type InteractionForGetSettings = {
  user: { id: string }
};

const createCachedGetSettingsFunction = (
  context: LoggerContext,
  interaction: InteractionForGetSettings,
): UserInteractionContext['getSettings'] => {
  let promiseCache: Promise<SettingsValue> | undefined;
  return () => {
    if (!promiseCache) {
      context.logger.debug(`Caching settings for user ${interaction.user.id} for this interaction`);
      promiseCache = getSettings(context, interaction.user.id);
    } else {
      context.logger.debug(`Re-using cached settings for user ${interaction.user.id} for this interaction`);
    }
    return promiseCache;
  };
};

export const handleContextMenuInteraction = async (interaction: MessageContextMenuCommandInteraction, {
  i18next,
  ...context
}: InteractionHandlerContext): Promise<void> => {
  const logger =  context.logger.nest(`Interaction#${interaction.id}`);
  const t = createTFunction({
    i18next,
    ephemeral: true,
    locale: interaction.locale,
    guild: interaction.guild,
  });
  const userInteractionContext: UserInteractionContext = {
    ...context,
    logger,
    t,
    getSettings: createCachedGetSettingsFunction({ logger }, interaction),
  };
  if (!isKnownMessageContextmenuInteraction(interaction)) {
    await interactionReply(userInteractionContext, interaction, {
      content: `Unsupported context menu interaction with name ${interaction.commandName}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { commandName, user, channel, channelId, guild, guildId } = interaction;
  const command = messageContextMenuCommandMap[commandName];

  logger.log(`${getUserIdentifier(user)} ran "${commandName}" in ${stringifyChannelName(channelId, channel)} of ${stringifyGuildName(guildId, guild)}`);

  try {
    await command.handle(interaction, userInteractionContext);
  } catch (e) {
    logger.error(`Error while responding to context menu command (commandName=${commandName})`, e);
    await handleInteractionError(interaction, userInteractionContext);
  }

  void sendCommandTelemetry(userInteractionContext, interaction)
    .then((telemetryResponse) => addTelemetryNoteToReply(userInteractionContext, interaction, telemetryResponse));
};

export const handleCommandInteraction = async (interaction: CommandInteraction, context: InteractionHandlerContext): Promise<void> => {
  if (interaction.isMessageContextMenuCommand()) {
    return handleContextMenuInteraction(interaction, context);
  }

  const t = createTFunction({
    i18next: context.i18next,
    ephemeral: true,
    locale: interaction.locale,
    guild: interaction.guild,
  });
  const { i18next, ...restContext } = context;
  const logger =  context.logger.nest(`Interaction#${interaction.id}`);
  const userInteractionContext: UserInteractionContext = {
    ...restContext,
    logger,
    t,
    getSettings: createCachedGetSettingsFunction({ logger }, interaction),
  };
  if (!isChatInputCommandInteraction(interaction)) {
    await interactionReply(userInteractionContext, interaction, {
      content: `Unsupported command type ${interaction.commandType} when running ${interaction.commandName}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const ephemeral = isEphemeralResponse(interaction, await userInteractionContext.getSettings());
  userInteractionContext.t = createTFunction({
    i18next,
    ephemeral,
    locale: interaction.locale,
    guild: interaction.guild,
  });

  if (!isKnownChatInputCommandInteraction(interaction)) {
    await interactionReply(userInteractionContext, interaction, { content: `Unknown command ${interaction.commandName}` });
    return;
  }

  const { commandName, user, options, channel, channelId, guild, guildId } = interaction;
  const command = chatInputCommandMap[commandName];

  const optionsString = options.data.length > 0
    ? ` ${stringifyOptionsData(interaction.options.data)}`
    : '';
  logger.log(`${getUserIdentifier(user)} ran /${commandName}${optionsString} in ${stringifyChannelName(channelId, channel)} of ${stringifyGuildName(guildId, guild)}`);

  try {
    await command.handle(interaction, userInteractionContext);
  } catch (e) {
    logger.error(`Error while responding to command interaction (commandName=${commandName})`, e);
    await handleInteractionError(interaction, userInteractionContext);
  }

  void sendCommandTelemetry(userInteractionContext, interaction)
    .then((telemetryResponse) => addTelemetryNoteToReply(userInteractionContext, interaction, telemetryResponse));
};

export const handleCommandAutocomplete = async (interaction: AutocompleteInteraction, {
  i18next,
  ...context
}: InteractionHandlerContext): Promise<void> => {
  const logger =  context.logger.nest(`Interaction#${interaction.id}`);
  if (!isKnownChatInputCommandInteraction(interaction)) {
    return;
  }

  const { commandName, locale, guild } = interaction;
  const command = chatInputCommandMap[commandName];
  const t = createTFunction({
    i18next,
    ephemeral: null,
    locale,
    guild,
  });
  const userInteractionContext: UserInteractionContext = {
      ...context,
      logger,
      t,
      getSettings: createCachedGetSettingsFunction({ logger }, interaction),
    };

  try {
    await command.autocomplete?.(interaction, userInteractionContext);
  } catch (e) {
    logger.error(`Error while responding to command autocomplete (commandName=${commandName})`, e);
    await handleInteractionError(interaction, userInteractionContext);
  }
};

export const handleComponentInteraction = async (interaction: MessageComponentInteraction, {
  i18next,
  ...context
}: InteractionHandlerContext): Promise<void> => {
  const logger =  context.logger.nest(`Interaction#${interaction.id}`);
  const t = createTFunction({
    i18next,
    ephemeral: true,
    locale: interaction.locale,
    guild: interaction.guild,
  });
  const userInteractionContext: UserInteractionContext = {
    ...context,
    logger,
    t,
    getSettings: createCachedGetSettingsFunction({ logger }, interaction),
  };
  if (!isKnownMessageComponentInteraction(interaction)) {
    await interactionReply(userInteractionContext, interaction, {
      content: `Unsupported component interaction with customId ${interaction.customId}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { customId, user, channel, channelId, guild, guildId } = interaction;
  const command = messageComponentMap[customId];

  logger.log(`${getUserIdentifier(user)} interacted with component "${customId}" in ${stringifyChannelName(channelId, channel)} of ${stringifyGuildName(guildId, guild)}`);

  try {
    await command.handle(interaction, userInteractionContext);
  } catch (e) {
    logger.error(`Error while responding to component interaction (customId=${customId})`, e);
    await handleInteractionError(interaction, userInteractionContext);
  }
};
