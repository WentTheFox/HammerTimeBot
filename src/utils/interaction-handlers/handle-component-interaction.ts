import { MessageFlags } from 'discord-api-types/v10';
import { MessageComponentInteraction } from 'discord.js';
import { InteractionHandlerContext, UserInteractionContext } from '../../types/bot-interaction.js';

import { interactionReply } from '../interaction-reply.js';
import {
  isKnownMessageComponentInteraction,
  messageComponentMap,
} from '../interactions/message-components.js';
import {
  getCustomIdSegments,
  getUserIdentifier,
  stringifyChannelName,
  stringifyGuildName,
} from '../messaging.js';
import { createCachedGetSettingsFunction } from './create-cached-get-settings-function.js';
import { createTFunction } from './create-t-function.js';
import { handleInteractionError } from './handle-interaction-error.js';

export const handleComponentInteraction = async (interaction: MessageComponentInteraction, {
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
  if (!isKnownMessageComponentInteraction(interaction)) {
    await interactionReply(userInteractionContext, interaction, {
      content: `Unsupported component interaction with customId ${interaction.customId}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { customId: customIdInput, user, channel, channelId, guild, guildId } = interaction;
  const { customId, resourceId } = getCustomIdSegments(customIdInput);
  const components = messageComponentMap[customId];

  logger.log(`${getUserIdentifier(user)} interacted with component "${customIdInput}" in ${stringifyChannelName(channelId, channel)} of ${stringifyGuildName(guildId, guild)}`);

  try {
    await components.handle(interaction, userInteractionContext, resourceId);
  } catch (e) {
    logger.error(`Error while responding to component interaction (customId=${customId},resourceId=${resourceId})`, e);
    await handleInteractionError(interaction, userInteractionContext);
  }
};
