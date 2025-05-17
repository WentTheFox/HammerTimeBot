import { BotChatInputCommand } from '../types/bot-interaction.js';
import { GlobalCommandOptionName, IsoCommandOptionName } from '../types/localization.js';
import { getLocalizedObject } from '../utils/get-localized-object.js';
import { replyWithSyntax } from '../utils/reply-with-syntax.js';
import { ApplicationCommandType, MessageFlags } from 'discord-api-types/v10';
import { getIsoCommandOptions } from '../options/iso.options.js';
import { findTimezoneOptionValue, handleTimezoneAutocomplete } from '../utils/messaging.js';
import { interactionReply } from '../utils/interaction-reply.js';
import { TZDate } from '@date-fns/tz';
import { isValid } from 'date-fns';

export const isoCommand: BotChatInputCommand = {
  getDefinition: (t) => ({
    type: ApplicationCommandType.ChatInput,
    ...getLocalizedObject('description', (lng) => t('commands.iso.description', { lng })),
    ...getLocalizedObject('name', (lng) => t('commands.iso.name', { lng })),
    options: getIsoCommandOptions(t),
  }),
  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);

    switch (focusedOption.name) {
      case GlobalCommandOptionName.TIMEZONE:
        await handleTimezoneAutocomplete(interaction);
        break;
      default:
        throw new Error(`Unknown autocomplete option ${focusedOption.name}`);
    }
  },
  async handle(interaction, context) {
    const settings = await context.getSettings();
    const { t } = context;
    const value = interaction.options.getString(IsoCommandOptionName.VALUE, true);
    const timezone = await findTimezoneOptionValue(t, interaction, settings);
    if (timezone === null) {
      return;
    }

    const localDate = TZDate.tz(timezone, value);
    if (!isValid(localDate)) {
      await interactionReply(t, interaction, {
        content: t('commands.iso.responses.invalidIsoFormat'),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await replyWithSyntax({ localDate, interaction, context, settings, timezone });
  },
};
