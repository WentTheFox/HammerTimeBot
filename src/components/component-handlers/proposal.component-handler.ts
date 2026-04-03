import { MessageFlags } from 'discord-api-types/v10';
import { userMention } from 'discord.js';
import typia from 'typia';
import { EmojiCharacters } from '../../constants/emoji-characters.js';
import { BotMessageComponentHandler } from '../../types/bot-interaction.js';
import { backendApiRequest } from '../../utils/backend-api-request.js';

export const proposalComponentHandler = (decision: 'approve' | 'reject'): BotMessageComponentHandler => async (interaction, context, resourceId) => {
  if (!interaction.isButton()) {
    throw new Error('Bot interaction expected');
  }

  if (!resourceId) {
    throw new Error('Mising proposal ID');
  }

  const { status, response } = await backendApiRequest(context, {
    path: `/credit-overrides/${resourceId}/review`,
    method: 'POST',
    body: {
      decision,
      approver: {
        id: interaction.user.id,
        username: interaction.user.displayName,
        global_name: interaction.user.globalName,
        discriminator: interaction.user.discriminator,
        avatar: interaction.user.avatar,
      },
    },
    validator: typia.createValidate<{ success: boolean, message?: string }>(),
  });

  if (status !== 200) {
    if (status === 404) {
      await interaction.reply({
        content: `No proposal found with ID ${resourceId} (it may have already been handled)`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: `Failed to ${decision} proposal with ID ${resourceId} (HTTP ${status})`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!response.success) {
    await interaction.reply({
      content: `Proposal review failed: ${response.message}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply({
    content: `${EmojiCharacters.GREEN_CHECK} Proposal reviewed as "${decision}" by ${userMention(interaction.user.id)}`,
  });
};
