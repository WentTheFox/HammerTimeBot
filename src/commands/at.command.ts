import { BotChatInputCommand } from '../types/bot-interaction.js';
import { isCommandError, resolveAt } from '@went.tf/hammertime-core';
import { AtCommandOptionName, GlobalCommandOptionName } from '../types/localization.js';
import { replyWithSyntax } from '../utils/reply-with-syntax.js';
import { handleHourAutocomplete, handleTimezoneAutocomplete } from '../utils/messaging.js';
import { replyWithCommandError } from '../utils/command-error.js';

export const atCommand: BotChatInputCommand = {
  name: 'at',
  autocomplete: {
    [GlobalCommandOptionName.TIMEZONE]: handleTimezoneAutocomplete,
    [AtCommandOptionName.HOUR]: handleHourAutocomplete,
  },
  async handle(interaction, context) {
    const settings = await context.getSettings();
    const { options } = interaction;
    const result = resolveAt({
      year: options.getInteger(AtCommandOptionName.YEAR),
      month: options.getInteger(AtCommandOptionName.MONTH),
      day: options.getInteger(AtCommandOptionName.DATE),
      hour: options.getString(AtCommandOptionName.HOUR),
      hour12: options.getInteger(AtCommandOptionName.HOUR12),
      minute: options.getInteger(AtCommandOptionName.MINUTE),
      second: options.getNumber(AtCommandOptionName.SECOND),
      am: options.getBoolean(AtCommandOptionName.AM),
      pm: options.getBoolean(AtCommandOptionName.PM),
      timezone: options.getString(GlobalCommandOptionName.TIMEZONE),
    }, settings);
    if (isCommandError(result)) {
      await replyWithCommandError(context, interaction, settings, result);
      return;
    }

    await replyWithSyntax({
      localDate: result.date,
      interaction,
      context,
      timezone: result.timezone,
      settings,
      usingAtHoursOnly: result.usingAtHoursOnly,
    });
  },
};
