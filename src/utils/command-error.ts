import { CommandError } from '@went.tf/hammertime-core';
import { MessageFlags } from 'discord-api-types/v10';
import { ChatInputCommandInteraction } from 'discord.js';
import { UserInteractionContext } from '../types/bot-interaction.js';
import { interactionReply } from './interaction-reply.js';
import { getUnsupportedTimezoneErrorMessage } from './messaging.js';
import { SettingsValue } from './settings.js';

/**
 * Replies (ephemerally) with the message for an error returned by one of the core command resolvers.
 * The error is a locale key, optionally with interpolation values.
 */
export const replyWithCommandError = async (
  context: UserInteractionContext,
  interaction: ChatInputCommandInteraction,
  settings: SettingsValue,
  { error, params }: CommandError,
) => {
  const content = error === 'commands.global.responses.unsupportedTimezone'
    ? getUnsupportedTimezoneErrorMessage(params?.timezone ?? '', context, settings)
    : context.t(error, params);
  await interactionReply(context, interaction, {
    content,
    flags: MessageFlags.Ephemeral,
  });
};
