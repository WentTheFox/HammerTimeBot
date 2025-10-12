import { BotChatInputCommand } from '../types/bot-interaction.js';
import { adjustDate, TimeMap } from '../utils/time.js';
import { AddCommandOptionName } from '../types/localization.js';
import { getLocalizedObject } from '../utils/get-localized-object.js';
import { replyWithSyntax } from '../utils/reply-with-syntax.js';
import { getAddOptions } from '../options/add.options.js';
import { atLeastOneNonZeroKey } from '../utils/at-least-one-non-zero-key.js';
import { MessageFlags } from 'discord-api-types/v10';
import { interactionReply } from '../utils/interaction-reply.js';
import { TZDate } from '@date-fns/tz';

export const addCommand: BotChatInputCommand = {
  getDefinition: (t) => ({
    ...getLocalizedObject('description', (lng) => t('commands.add.description', { lng })),
    ...getLocalizedObject('name', (lng) => t('commands.add.name', { lng })),
    options: getAddOptions(t),
  }),
  async handle(interaction, context) {
    const settings = await context.getSettings();
    const { t } = context;
    const to = interaction.options.getNumber(AddCommandOptionName.TO, true);
    const now = TZDate.tz('UTC', to * 1e3);
    const options: TimeMap = {
      years: interaction.options.getInteger(AddCommandOptionName.ADD_YEARS),
      months: interaction.options.getInteger(AddCommandOptionName.ADD_MONTHS),
      days: interaction.options.getInteger(AddCommandOptionName.ADD_DAYS),
      hours: interaction.options.getInteger(AddCommandOptionName.ADD_HOURS),
      minutes: interaction.options.getInteger(AddCommandOptionName.ADD_MINUTES),
      seconds: interaction.options.getNumber(AddCommandOptionName.ADD_SECONDS),
    };

    if (!atLeastOneNonZeroKey(options)) {
      await interactionReply(context, interaction, {
        content: t('commands.global.responses.noComponentsUnix', {
          replace: {
            unixCommand: t('commands.unix.name'),
          },
        }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const localDate = adjustDate(options, 'add', now);

    await replyWithSyntax({
      localDate,
      interaction,
      context,
      settings,
      timezone: undefined,
    });
  },
};
