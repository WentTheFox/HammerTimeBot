import { BotChatInputCommand } from '../types/bot-interaction.js';
import { SnowflakeCommandOptionName } from '../types/localization.js';
import { replyWithSyntax } from '../utils/reply-with-syntax.js';
import { isCommandError, resolveSnowflake } from '@went.tf/hammertime-core';
import { replyWithCommandError } from '../utils/command-error.js';

export const snowflakeCommand: BotChatInputCommand = {
  name: 'snowflake',
  async handle(interaction, context) {
    const settings = await context.getSettings();
    const result = resolveSnowflake({ value: interaction.options.getString(SnowflakeCommandOptionName.VALUE, true) });
    if (isCommandError(result)) {
      await replyWithCommandError(context, interaction, settings, result);
      return;
    }

    await replyWithSyntax({ localDate: result.date, interaction, context, settings, timezone: result.timezone });
  },
};
