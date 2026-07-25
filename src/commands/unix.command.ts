import { BotChatInputCommand, BotChatInputCommandName } from '../types/bot-interaction.js';
import { UnixCommandOptionName } from '../types/localization.js';
import { replyWithSyntax } from '../utils/reply-with-syntax.js';
import { TZDate } from '@date-fns/tz';

export const unixCommand: BotChatInputCommand = {
  name: BotChatInputCommandName.UNIX,
  async handle(interaction, context) {
    const settings = await context.getSettings();
    const value = interaction.options.getInteger(UnixCommandOptionName.VALUE, true);
    const localDate = TZDate.tz('UTC', value * 1e3);

    await replyWithSyntax({ localDate, interaction, context, settings, timezone: undefined });
  },
};
