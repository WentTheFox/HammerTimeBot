import { BotChatInputCommand } from '../types/bot-interaction.js';
import { isCommandError, resolveSubtract } from '@went.tf/hammertime-core';
import { SubtractCommandOptionName } from '../types/localization.js';
import { replyWithSyntax } from '../utils/reply-with-syntax.js';
import { replyWithCommandError } from '../utils/command-error.js';

export const subtractCommand: BotChatInputCommand = {
  name: 'subtract',
  async handle(interaction, context) {
    const settings = await context.getSettings();
    const { options } = interaction;
    const result = resolveSubtract({
      from: options.getNumber(SubtractCommandOptionName.FROM, true),
      years: options.getInteger(SubtractCommandOptionName.SUBTRACT_YEARS),
      months: options.getInteger(SubtractCommandOptionName.SUBTRACT_MONTHS),
      days: options.getInteger(SubtractCommandOptionName.SUBTRACT_DAYS),
      hours: options.getInteger(SubtractCommandOptionName.SUBTRACT_HOURS),
      minutes: options.getInteger(SubtractCommandOptionName.SUBTRACT_MINUTES),
      seconds: options.getNumber(SubtractCommandOptionName.SUBTRACT_SECONDS),
    });
    if (isCommandError(result)) {
      await replyWithCommandError(context, interaction, settings, result);
      return;
    }

    await replyWithSyntax({ localDate: result.date, interaction, context, settings, timezone: result.timezone });
  },
};
