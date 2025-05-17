import { BotChatInputCommand } from '../types/bot-interaction.js';
import { constrain, getGmtTimezoneValue, gmtZoneRegex, processMixedHourParameters } from '../utils/time.js';
import { AtCommandOptionName, GlobalCommandOptionName } from '../types/localization.js';
import { getLocalizedObject } from '../utils/get-localized-object.js';
import { replyWithSyntax } from '../utils/reply-with-syntax.js';
import { getAtOptions } from '../options/at.options.js';
import { ApplicationCommandType, MessageFlags } from 'discord-api-types/v10';
import { findTimezoneOptionValue, handleHourAutocomplete, handleTimezoneAutocomplete } from '../utils/messaging.js';
import { interactionReply } from '../utils/interaction-reply.js';
import { TZDate } from '@date-fns/tz';
import { setDate, setHours, setMilliseconds, setMinutes, setMonth, setSeconds, setYear } from 'date-fns';

export const atCommand: BotChatInputCommand = {
  getDefinition: (t) => ({
    type: ApplicationCommandType.ChatInput,
    ...getLocalizedObject('description', (lng) => t('commands.at.description', { lng })),
    ...getLocalizedObject('name', (lng) => t('commands.at.name', { lng })),
    options: getAtOptions(t),
  }),
  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);

    switch (focusedOption.name) {
      case GlobalCommandOptionName.TIMEZONE:
        await handleTimezoneAutocomplete(interaction);
        break;
      case AtCommandOptionName.HOUR:
        await handleHourAutocomplete(interaction);
        break;
      default:
        throw new Error(`Unknown autocomplete option ${focusedOption.name}`);
    }
  },
  async handle(interaction, context) {
    const settings = await context.getSettings();
    const { t } = context;
    const year = interaction.options.getInteger(AtCommandOptionName.YEAR);
    const month = interaction.options.getInteger(AtCommandOptionName.MONTH);
    const date = interaction.options.getInteger(AtCommandOptionName.DATE);
    const hourStr = interaction.options.getString(AtCommandOptionName.HOUR);
    const hour12 = interaction.options.getInteger(AtCommandOptionName.HOUR12);
    const minute = interaction.options.getInteger(AtCommandOptionName.MINUTE) ?? settings.defaultAtMinute;
    const second = interaction.options.getNumber(AtCommandOptionName.SECOND) ?? settings.defaultAtSecond;
    const am = interaction.options.getBoolean(AtCommandOptionName.AM);
    const pm = interaction.options.getBoolean(AtCommandOptionName.PM);

    const hour = processMixedHourParameters({ t, settings, hourStr, hour12, am, pm });
    if (typeof hour === 'string') {
      await interactionReply(t, interaction, {
        content: hour,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const timezone = await findTimezoneOptionValue(t, interaction, settings);
    if (timezone === null) {
      return;
    }

    let localDate: TZDate;
    try {
      if (gmtZoneRegex.test(timezone)) {
        const utcOffset = getGmtTimezoneValue(timezone, 0);
        localDate = TZDate.tz(utcOffset.toString());
      } else {
        localDate = TZDate.tz(timezone);
      }
      localDate = setMilliseconds(localDate, 0);
      if (year !== null) localDate = setYear(localDate, constrain(year, 0, 275759));
      if (month !== null) localDate = setMonth(localDate, constrain(month - 1, 0, 11));
      if (date !== null) localDate = setDate(localDate, constrain(date, 1, 31));
      if (hour !== null) localDate = setHours(localDate, constrain(hour, 0, 23));
      if (minute !== null) localDate = setMinutes(localDate, constrain(minute, 0, 59));
      if (second !== null) localDate = setSeconds(localDate, constrain(second, 0, 59));
    } catch (e) {
      if (e instanceof RangeError && e.message === 'Invalid date') {
        await interactionReply(t, interaction, {
          content: t('commands.global.responses.invalidDate'),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      throw e;
    }

    const usingAtHoursOnly = (hourStr !== null && !/[ap]m$/.test(hourStr)) && am == null && pm === null;
    await replyWithSyntax({ localDate, interaction, context, timezone, settings, usingAtHoursOnly });
  },
};
