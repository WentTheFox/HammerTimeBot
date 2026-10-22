import { BotChatInputCommand } from '../types/bot-interaction.js';
import { UnixCommandOptionName } from '../types/localization.js';
import { replyWithSyntax } from '../utils/reply-with-syntax.js';
import { isCommandError, resolveUnix } from '@went.tf/hammertime-core';
import { replyWithCommandError } from '../utils/command-error.js';
import { handleTimestampCommand } from '../utils/handle-timestamp-command.js';

export const unixCommand: BotChatInputCommand = {
  name: 'unix',
  async handle(interaction, context) {
    const settings = await context.getSettings();
    await handleTimestampCommand({
      name: 'unix',
      interaction,
      context,
      settings,
      handleLocally: async () => {
        const result = resolveUnix({ value: interaction.options.getInteger(UnixCommandOptionName.VALUE, true) });
        if (isCommandError(result)) {
          await replyWithCommandError(context, interaction, settings, result);
          return;
        }

        await replyWithSyntax({ localDate: result.date, interaction, context, settings, timezone: result.timezone });
      },
    });
  },
};
