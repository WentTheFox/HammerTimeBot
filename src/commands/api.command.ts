import { BotChatInputCommand, BotChatInputCommandName } from '../types/bot-interaction.js';
import { env } from '../env.js';
import { ApiCommandOptionName } from '../types/localization.js';
import { updateBotTimezonesInApi, updateCommandsFromInteraction } from '../utils/backend-api-data-updaters.js';
import { emoji } from '../utils/messaging.js';
import { EmojiCharacters } from '../constants/emoji-characters.js';

export const apiCommand: BotChatInputCommand = {
  name: BotChatInputCommandName.API,
  registerCondition: () => env.LOCAL,
  async handle(interaction, context) {
    const subcommand = interaction.options.getSubcommand(true);
    const loadingEmoji = emoji(context, 'loading', true);
    switch (subcommand) {
      case ApiCommandOptionName.UPDATE_BOT_COMMANDS:
        await interaction.reply(`${loadingEmoji} Updating bot commands…`);
        await updateCommandsFromInteraction(context, async progress => {
          await interaction.editReply(`${loadingEmoji} ${progress}`);
        });
        break;
      case ApiCommandOptionName.UPDATE_BOT_TIMEZONES:
        await interaction.reply(`${loadingEmoji} Updating bot timezones…`);
        await updateBotTimezonesInApi(context);
        break;
      default:
        await interaction.reply(`Unknown subcommand ${subcommand}`);
        return;
    }

    await interaction.editReply(`${EmojiCharacters.GREEN_CHECK} Done`);
  },
};
