import { BotChatInputCommand } from '../types/bot-interaction.js';
import { UnixCommandOptionName } from '../types/localization.js';
import { getLocalizedObject } from '../utils/get-localized-object.js';
import { replyWithSyntax } from '../utils/reply-with-syntax.js';
import { getUnixCommandOptions } from '../options/unix.options.js';
import { ApplicationCommandType } from 'discord-api-types/v10';
import { TZDate } from '@date-fns/tz';

export const unixCommand: BotChatInputCommand = {
  getDefinition: (t) => ({
    type: ApplicationCommandType.ChatInput,
    ...getLocalizedObject('description', (lng) => t('commands.unix.description', { lng })),
    ...getLocalizedObject('name', (lng) => t('commands.unix.name', { lng })),
    options: getUnixCommandOptions(t),
  }),
  async handle(interaction, context) {
    const settings = await context.getSettings();
    const value = interaction.options.getInteger(UnixCommandOptionName.VALUE, true);
    const localDate = TZDate.tz('UTC', value * 1e3);

    await replyWithSyntax({ localDate, interaction, context, settings, timezone: undefined });
  },
};
