import { getSnowflakeCommandOptions } from '../options/snowflake.options.js';
import { BotChatInputCommand } from '../types/bot-interaction.js';
import { SnowflakeCommandOptionName } from '../types/localization.js';
import { getLocalizedObject } from '../utils/get-localized-object.js';
import { replyWithSyntax } from '../utils/reply-with-syntax.js';
import snowflakeToUnix from '../utils/snowflake.js';
import { SnowflakeError } from '../classes/snowflake-error.js';
import { ApplicationCommandType, MessageFlags } from 'discord-api-types/v10';
import { interactionReply } from '../utils/interaction-reply.js';
import { TZDate } from '@date-fns/tz';

export const snowflakeCommand: BotChatInputCommand = {
  getDefinition: (t) => ({
    type: ApplicationCommandType.ChatInput,
    ...getLocalizedObject('description', (lng) => t('commands.snowflake.description', { lng })),
    ...getLocalizedObject('name', (lng) => t('commands.snowflake.name', { lng })),
    options: getSnowflakeCommandOptions(t),
  }),
  async handle(interaction, context) {
    const settings = await context.getSettings();
    const { t } = context;
    const snowflake = interaction.options.getString(SnowflakeCommandOptionName.VALUE, true);
    let unixValue;
    try {
      unixValue = snowflakeToUnix(snowflake);
    } catch (e) {
      if (e instanceof SnowflakeError) {
        await interactionReply(t, interaction, {
          content: t('commands.snowflake.responses.invalidSnowflake'),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      throw e;
    }
    const localDate = TZDate.tz('UTC', unixValue * 1e3);

    await replyWithSyntax({ localDate, interaction, context, settings, timezone: undefined });
  },
};
