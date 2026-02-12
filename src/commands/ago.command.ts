import { BotChatInputCommand } from '../types/bot-interaction.js';
import { adjustDate, TimeMap } from '../utils/time.js';
import { AgoCommandOptionName } from '../types/localization.js';
import { getLocalizedObject } from '../utils/get-localized-object.js';
import { replyWithSyntax } from '../utils/reply-with-syntax.js';
import { getAgoOptions } from '../options/ago.options.js';
import { atLeastOneNonZeroKey } from '../utils/at-least-one-non-zero-key.js';
import { ApplicationCommandType, MessageFlags } from 'discord-api-types/v10';
import { interactionReply } from '../utils/interaction-reply.js';
import { TZDate } from '@date-fns/tz';

export const agoCommand: BotChatInputCommand = {
  getDefinition: (t) => ({
    type: ApplicationCommandType.ChatInput,
    ...getLocalizedObject('description', (lng) => t('commands.ago.description', { lng })),
    ...getLocalizedObject('name', (lng) => t('commands.ago.name', { lng })),
    options: getAgoOptions(t),
  }),
  async handle(interaction, context) {
    const settings = await context.getSettings();
    const { t } = context;
    const options: TimeMap = {
      years: interaction.options.getInteger(AgoCommandOptionName.YEARS_AGO),
      months: interaction.options.getInteger(AgoCommandOptionName.MONTHS_AGO),
      days: interaction.options.getInteger(AgoCommandOptionName.DAYS_AGO),
      hours: interaction.options.getInteger(AgoCommandOptionName.HOURS_AGO),
      minutes: interaction.options.getInteger(AgoCommandOptionName.MINUTES_AGO),
      seconds: interaction.options.getNumber(AgoCommandOptionName.SECONDS_AGO),
    };

    if (!atLeastOneNonZeroKey(options)) {
      await interactionReply(context, interaction, {
        content: t('commands.global.responses.noComponentsCurrentTime', {
          atCommand: 'at',
        }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Fixed value for relative timestamps
    const timezone = 'UTC';
    const localDate = adjustDate(options, 'subtract', TZDate.tz(timezone));

    await replyWithSyntax({ localDate, interaction, context, timezone, settings });
  },
};
