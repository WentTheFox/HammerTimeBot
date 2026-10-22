import { BotChatInputCommand } from '../types/bot-interaction.js';
import { isCommandError, resolveAdd } from '@went.tf/hammertime-core';
import { AddCommandOptionName } from '../types/localization.js';
import { replyWithSyntax } from '../utils/reply-with-syntax.js';
import { replyWithCommandError } from '../utils/command-error.js';
import { handleTimestampCommand } from '../utils/handle-timestamp-command.js';

export const addCommand: BotChatInputCommand = {
  name: 'add',
  async handle(interaction, context) {
    const settings = await context.getSettings();
    await handleTimestampCommand({
      name: 'add',
      interaction,
      context,
      settings,
      handleLocally: async () => {
        const { options } = interaction;
        const result = resolveAdd({
          to: options.getNumber(AddCommandOptionName.TO, true),
          years: options.getInteger(AddCommandOptionName.ADD_YEARS),
          months: options.getInteger(AddCommandOptionName.ADD_MONTHS),
          days: options.getInteger(AddCommandOptionName.ADD_DAYS),
          hours: options.getInteger(AddCommandOptionName.ADD_HOURS),
          minutes: options.getInteger(AddCommandOptionName.ADD_MINUTES),
          seconds: options.getNumber(AddCommandOptionName.ADD_SECONDS),
        });
        if (isCommandError(result)) {
          await replyWithCommandError(context, interaction, settings, result);
          return;
        }

        await replyWithSyntax({ localDate: result.date, interaction, context, settings, timezone: result.timezone });
      },
    });
  },
};
