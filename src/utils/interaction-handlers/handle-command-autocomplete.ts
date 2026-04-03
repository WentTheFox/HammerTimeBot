import { AutocompleteInteraction } from 'discord.js';
import { InteractionHandlerContext, UserInteractionContext } from '../../types/bot-interaction.js';
import {
  chatInputCommandMap,
  isKnownChatInputCommandInteraction,
} from '../interactions/chat-input-commands.js';
import { createCachedGetSettingsFunction } from './create-cached-get-settings-function.js';
import { createTFunction } from './create-t-function.js';
import { handleInteractionError } from './handle-interaction-error.js';

export const handleCommandAutocomplete = async (interaction: AutocompleteInteraction, {
  i18next,
  ...context
}: InteractionHandlerContext): Promise<void> => {
  const logger = context.logger.nest(`Interaction#${interaction.id}`);
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
