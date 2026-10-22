import { BotChatInputCommand } from '../types/bot-interaction.js';
import { GlobalCommandOptionName, IsoCommandOptionName } from '../types/localization.js';
import { replyWithSyntax } from '../utils/reply-with-syntax.js';
import { handleTimezoneAutocomplete } from '../utils/messaging.js';
import { isCommandError, resolveIso } from '@went.tf/hammertime-core';
import { replyWithCommandError } from '../utils/command-error.js';
import { handleTimestampCommand } from '../utils/handle-timestamp-command.js';

export const isoCommand: BotChatInputCommand = {
  name: 'iso',
  autocomplete: {
    [GlobalCommandOptionName.TIMEZONE]: handleTimezoneAutocomplete,
  },
  async handle(interaction, context) {
    const settings = await context.getSettings();
    await handleTimestampCommand({
      name: 'iso',
      interaction,
      context,
      settings,
      handleLocally: async () => {
        const result = resolveIso({
          value: interaction.options.getString(IsoCommandOptionName.VALUE, true),
          timezone: interaction.options.getString(GlobalCommandOptionName.TIMEZONE),
        }, settings);
        if (isCommandError(result)) {
          await replyWithCommandError(context, interaction, settings, result);
          return;
        }

        await replyWithSyntax({ localDate: result.date, interaction, context, settings, timezone: result.timezone });
      },
    });
  },
};
