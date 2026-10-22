import { BotChatInputCommand } from '../types/bot-interaction.js';
import { isCommandError, resolveAt12 } from '@went.tf/hammertime-core';
import { At12CommandOptionName, GlobalCommandOptionName } from '../types/localization.js';
import { replyWithSyntax } from '../utils/reply-with-syntax.js';
import { handleTimezoneAutocomplete } from '../utils/messaging.js';
import { replyWithCommandError } from '../utils/command-error.js';
import { handleTimestampCommand } from '../utils/handle-timestamp-command.js';

export const at12Command: BotChatInputCommand = {
  name: 'at12',
  autocomplete: {
    [GlobalCommandOptionName.TIMEZONE]: handleTimezoneAutocomplete,
  },
  async handle(interaction, context) {
    const settings = await context.getSettings();
    await handleTimestampCommand({
      name: 'at12',
      interaction,
      context,
      settings,
      handleLocally: async () => {
        const { options } = interaction;
        const result = resolveAt12({
          year: options.getInteger(At12CommandOptionName.YEAR),
          month: options.getInteger(At12CommandOptionName.MONTH),
          day: options.getInteger(At12CommandOptionName.DATE),
          hour: options.getInteger(At12CommandOptionName.HOUR),
          minute: options.getInteger(At12CommandOptionName.MINUTE),
          second: options.getNumber(At12CommandOptionName.SECOND),
          am: options.getBoolean(At12CommandOptionName.AM),
          pm: options.getBoolean(At12CommandOptionName.PM),
          timezone: options.getString(GlobalCommandOptionName.TIMEZONE),
        }, settings);
        if (isCommandError(result)) {
          await replyWithCommandError(context, interaction, settings, result);
          return;
        }

        await replyWithSyntax({ localDate: result.date, interaction, context, timezone: result.timezone, settings });
      },
    });
  },
};
