import { MessageFlags } from 'discord-api-types/v10';
import { MessageContextMenuCommandInteraction } from 'discord.js';
import { InteractionHandlerContext, UserInteractionContext } from '../../types/bot-interaction.js';
import { addTelemetryNoteToReply } from '../add-telemetry-note-to-reply.js';
import { sendCommandTelemetry } from '../backend-api-data-updaters.js';
import { interactionReply } from '../interaction-reply.js';
import {
  isKnownMessageContextmenuInteraction,
  messageContextMenuCommandMap,
} from '../interactions/message-context-menu-commands.js';
import { getUserIdentifier, stringifyChannelName, stringifyGuildName } from '../messaging.js';
import { createCachedGetSettingsFunction } from './create-cached-get-settings-function.js';
import { createTFunction } from './create-t-function.js';
import { handleInteractionError } from './handle-interaction-error.js';

export const handleContextMenuInteraction = async (interaction: MessageContextMenuCommandInteraction, {
  i18next,
  ...context
}: InteractionHandlerContext): Promise<void> => {
  const logger = context.logger.nest(`Interaction#${interaction.id}`);
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
