import { Interaction } from 'discord.js';
import { InteractionHandlerContext, UserInteractionContext } from '../types/bot-interaction.js';
import { isEphemeralResponse } from './messaging.js';
import { createCachedGetSettingsFunction } from './interaction-handlers/create-cached-get-settings-function.js';
import { createTFunction } from './interaction-handlers/create-t-function.js';

export const buildUserInteractionContext = async (
  interaction: Interaction,
  { i18next, ...context }: InteractionHandlerContext,
): Promise<UserInteractionContext> => {
  const logger = context.logger.nest(`Interaction#${interaction.id}`);
  const getSettings = createCachedGetSettingsFunction({ logger }, interaction);

  const t = createTFunction({
    i18next,
    ephemeral: interaction.isAutocomplete() ? null : true,
    locale: interaction.locale,
    guild: interaction.guild,
  });

  const userInteractionContext: UserInteractionContext = { ...context, logger, t, getSettings };

  if (interaction.isChatInputCommand()) {
    const ephemeral = isEphemeralResponse(interaction, await getSettings());
    userInteractionContext.t = createTFunction({ i18next, ephemeral, locale: interaction.locale, guild: interaction.guild });
  }

  return userInteractionContext;
};
