import { BotChatInputCommand, BotChatInputCommandName } from '../types/bot-interaction.js';
import { GlobalCommandOptionName, IsoCommandOptionName } from '../types/localization.js';
import { getLocalizedObject } from '../utils/get-localized-object.js';
import { replyWithSyntax } from '../utils/reply-with-syntax.js';
import { ApplicationCommandType, MessageFlags } from 'discord-api-types/v10';
import { getIsoCommandOptions } from '../options/iso.options.js';
import { findTimezoneOptionValue, handleTimezoneAutocomplete } from '../utils/messaging.js';
import { interactionReply } from '../utils/interaction-reply.js';
import { TZDate } from '@date-fns/tz';
import { isValid } from 'date-fns';
import { TimezoneError } from '../classes/timezone-error.js';

export const isoCommand: BotChatInputCommand = {
  name: BotChatInputCommandName.ISO,
  getDefinition: (t) => {
    if (!t) throw new Error('Missing translation function');
    return {
      type: ApplicationCommandType.ChatInput,
      ...getLocalizedObject('description', (lng) => t('commands.iso.description', { lng })),
      ...getLocalizedObject('name', (lng) => t('commands.iso.name', { lng })),
      options: getIsoCommandOptions(t),
    };
  },
  autocomplete: {
    [GlobalCommandOptionName.TIMEZONE]: handleTimezoneAutocomplete,
  },
  async handle(interaction, context) {
    const settings = await context.getSettings();
    const { t } = context;
    const value = interaction.options.getString(IsoCommandOptionName.VALUE, true);
    const timezone = await findTimezoneOptionValue(context, interaction, settings);
    if (timezone instanceof TimezoneError) {
      return;
    }

    const localDate = TZDate.tz(timezone, value);
    if (!isValid(localDate)) {
      await interactionReply(context, interaction, {
        content: t('commands.iso.responses.invalidIsoFormat'),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await replyWithSyntax({ localDate, interaction, context, settings, timezone });
  },
};
