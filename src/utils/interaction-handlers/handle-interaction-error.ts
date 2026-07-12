import {
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  CommandInteraction,
  ContextMenuCommandInteraction,
  MessageComponentInteraction,
  RepliableInteraction,
} from 'discord.js';
import { handleInteractionError as frameworkHandleInteractionError } from '@wentthefox-org/discord-bot-framework/interactions';
import { EmojiCharacters } from '../../constants/emoji-characters.js';
import { UserInteractionContext } from '../../types/bot-interaction.js';
import { interactionReply } from '../interaction-reply.js';

export const handleInteractionError = async (
  interaction: ChatInputCommandInteraction | ButtonInteraction | AutocompleteInteraction | ContextMenuCommandInteraction | MessageComponentInteraction,
  context: UserInteractionContext,
): Promise<void> => frameworkHandleInteractionError(interaction as RepliableInteraction | AutocompleteInteraction, context, {
  buildMessage: () => `${EmojiCharacters.OCTAGONAL_SIGN} ${context.t('commands.global.responses.unexpectedError')}`,
  reply: (repliableInteraction, options) => interactionReply(context, repliableInteraction as CommandInteraction, options),
});
