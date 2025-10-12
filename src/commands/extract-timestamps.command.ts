import { BotMessageContextMenuCommand } from '../types/bot-interaction.js';
import { getLocalizedObject } from '../utils/get-localized-object.js';
import { ApplicationCommandType, ComponentType, MessageFlags } from 'discord-api-types/v10';
import { extractTimestampsFromStrings } from '../utils/extract-timestamps-from-strings.js';
import { RESPONSE_FORMATTERS } from '../utils/time.js';
import { ResponseColumnChoices } from '../types/localization.js';
import { interactionReply } from '../utils/interaction-reply.js';
import { findEmbedsTextFields, findTextComponentContentsRecursively } from '../utils/messaging.js';

export const extractTimestampsCommand: BotMessageContextMenuCommand = {
  getDefinition: (t) => ({
    type: ApplicationCommandType.Message,
    ...getLocalizedObject('name', (lng) => t('commands.Extract Timestamps.name', { lng }), true, false),
  }),
  async handle(interaction, context) {
    const { t } = context;
    const messageTarget = t('commands.Extract Timestamps.responses.targetMessage', { replace: { url: interaction.targetMessage.url } });
    const contentPrefix = `${messageTarget}\n\n`;

    const timestamps = extractTimestampsFromStrings([
      interaction.targetMessage.content,
      ...findTextComponentContentsRecursively(interaction.targetMessage.components),
      ...findEmbedsTextFields(interaction.targetMessage.embeds),
    ]);
    if (timestamps.length === 0) {
      await interactionReply(context, interaction, {
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: [
          {
            type: ComponentType.TextDisplay,
            content: contentPrefix + t('commands.Extract Timestamps.responses.noTimestamps'),
          },
        ],
      });
      return;
    }

    await interactionReply(context, interaction, {
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      components: [
        {
          type: ComponentType.TextDisplay,
          content: contentPrefix + timestamps.map(ts => `* ${RESPONSE_FORMATTERS[ResponseColumnChoices.BOTH](ts)}`).join('\n'),
        },
      ],
    });
  },
};
