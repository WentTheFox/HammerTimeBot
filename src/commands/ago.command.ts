import { BotChatInputCommand } from '../types/bot-interaction.js';
import { isCommandError, resolveAgo } from '@went.tf/hammertime-core';
import { AgoCommandOptionName } from '../types/localization.js';
import { replyWithSyntax } from '../utils/reply-with-syntax.js';
import { replyWithCommandError } from '../utils/command-error.js';

export const agoCommand: BotChatInputCommand = {
  name: 'ago',
  async handle(interaction, context) {
    const settings = await context.getSettings();
    const { options } = interaction;
    const result = resolveAgo({
      years: options.getInteger(AgoCommandOptionName.YEARS_AGO),
      months: options.getInteger(AgoCommandOptionName.MONTHS_AGO),
      days: options.getInteger(AgoCommandOptionName.DAYS_AGO),
      hours: options.getInteger(AgoCommandOptionName.HOURS_AGO),
      minutes: options.getInteger(AgoCommandOptionName.MINUTES_AGO),
      seconds: options.getNumber(AgoCommandOptionName.SECONDS_AGO),
    });
    if (isCommandError(result)) {
      await replyWithCommandError(context, interaction, settings, result);
      return;
    }

    await replyWithSyntax({ localDate: result.date, interaction, context, settings, timezone: result.timezone });
  },
};
