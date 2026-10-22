import { BotChatInputCommand } from '../types/bot-interaction.js';
import { isCommandError, resolveIn } from '@went.tf/hammertime-core';
import { InCommandOptionName } from '../types/localization.js';
import { replyWithSyntax } from '../utils/reply-with-syntax.js';
import { replyWithCommandError } from '../utils/command-error.js';

export const inCommand: BotChatInputCommand = {
  name: 'in',
  async handle(interaction, context) {
    const settings = await context.getSettings();
    const { options } = interaction;
    const result = resolveIn({
      years: options.getInteger(InCommandOptionName.IN_YEARS),
      months: options.getInteger(InCommandOptionName.IN_MONTHS),
      days: options.getInteger(InCommandOptionName.IN_DAYS),
      hours: options.getInteger(InCommandOptionName.IN_HOURS),
      minutes: options.getInteger(InCommandOptionName.IN_MINUTES),
      seconds: options.getNumber(InCommandOptionName.IN_SECONDS),
    });
    if (isCommandError(result)) {
      await replyWithCommandError(context, interaction, settings, result);
      return;
    }

    await replyWithSyntax({ localDate: result.date, interaction, context, settings, timezone: result.timezone });
  },
};
