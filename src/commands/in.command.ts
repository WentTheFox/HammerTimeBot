import { BotChatInputCommand, BotChatInputCommandName } from '../types/bot-interaction.js';
import { adjustDate, TimeMap } from '../utils/time.js';
import { InCommandOptionName } from '../types/localization.js';
import { replyWithSyntax } from '../utils/reply-with-syntax.js';
import { atLeastOneNonZeroKey } from '../utils/at-least-one-non-zero-key.js';
import { MessageFlags } from 'discord-api-types/v10';
import { TZDate } from '@date-fns/tz';
import { interactionReply } from '../utils/interaction-reply.js';

export const inCommand: BotChatInputCommand = {
  name: BotChatInputCommandName.IN,
  async handle(interaction, context) {
    const settings = await context.getSettings();
    const { t } = context;
    const options: TimeMap = {
      years: interaction.options.getInteger(InCommandOptionName.IN_YEARS),
      months: interaction.options.getInteger(InCommandOptionName.IN_MONTHS),
      days: interaction.options.getInteger(InCommandOptionName.IN_DAYS),
      hours: interaction.options.getInteger(InCommandOptionName.IN_HOURS),
      minutes: interaction.options.getInteger(InCommandOptionName.IN_MINUTES),
      seconds: interaction.options.getNumber(InCommandOptionName.IN_SECONDS),
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
    const localDate = adjustDate(options, 'add', TZDate.tz(timezone));

    await replyWithSyntax({ localDate, interaction, context, timezone, settings });
  },
};
