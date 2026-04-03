import { MessageFlags } from 'discord-api-types/v10';
import { CommandInteraction } from 'discord.js';
import { InteractionHandlerContext, UserInteractionContext } from '../../types/bot-interaction.js';
import { addTelemetryNoteToReply } from '../add-telemetry-note-to-reply.js';
import { sendCommandTelemetry } from '../backend-api-data-updaters.js';
import { interactionReply } from '../interaction-reply.js';
import {
  chatInputCommandMap,
  isKnownChatInputCommandInteraction,
} from '../interactions/chat-input-commands.js';
import {
  getUserIdentifier,
  isEphemeralResponse,
  stringifyChannelName,
  stringifyGuildName,
  stringifyOptionsData,
} from '../messaging.js';
import { createCachedGetSettingsFunction } from './create-cached-get-settings-function.js';
import { createTFunction } from './create-t-function.js';
import { handleContextMenuInteraction } from './handle-context-menu-interaction.js';
import { handleInteractionError } from './handle-interaction-error.js';

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
  const logger = context.logger.nest(`Interaction#${interaction.id}`);
  const userInteractionContext: UserInteractionContext = {
    ...restContext,
    logger,
    t,
    getSettings: createCachedGetSettingsFunction({ logger }, interaction),
  };
  if (!interaction.isChatInputCommand()) {
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
