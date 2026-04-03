import { MessageFlags } from 'discord-api-types/v10';
import {
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  ComponentType,
  ContextMenuCommandInteraction,
  DiscordjsError,
  DiscordjsErrorCodes,
  InteractionType,
  MessageComponentInteraction,
} from 'discord.js';
import { TFunction } from 'i18next';
import { EmojiCharacters } from '../../constants/emoji-characters.js';
import { UserInteractionContext } from '../../types/bot-interaction.js';
import { interactionReply } from '../interaction-reply.js';

const ellipsis = '…';

const processingErrorMessageFactory = (t: TFunction): string => `${EmojiCharacters.OCTAGONAL_SIGN} ${t('commands.global.responses.unexpectedError')}`;

export const handleInteractionError = async (interaction: ChatInputCommandInteraction | ButtonInteraction | AutocompleteInteraction | ContextMenuCommandInteraction | MessageComponentInteraction, context: UserInteractionContext) => {
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
