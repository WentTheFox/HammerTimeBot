import { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import { BotChatInputCommand, BotChatInputCommandName } from '../../types/bot-interaction.js';
import { addCommand } from '../../commands/add.command.js';
import { agoCommand } from '../../commands/ago.command.js';
import { atCommand } from '../../commands/at.command.js';
import { inCommand } from '../../commands/in.command.js';
import { statisticsCommand } from '../../commands/statistics.command.js';
import { subtractCommand } from '../../commands/subtract.command.js';
import { unixCommand } from '../../commands/unix.command.js';
import { snowflakeCommand } from '../../commands/snowflake.command.js';
import { isoCommand } from '../../commands/iso.command.js';
import { settingsCommand } from '../../commands/settings.command.js';
import { apiCommand } from '../../commands/api.command.js';
import { at12Command } from '../../commands/at12.command.js';
import { faqCommand } from '../../commands/faq.command.js';

export const chatInputCommandMap: Record<BotChatInputCommandName, BotChatInputCommand> = {
  [BotChatInputCommandName.ADD]: addCommand,
  [BotChatInputCommandName.AGO]: agoCommand,
  [BotChatInputCommandName.AT]: atCommand,
  [BotChatInputCommandName.IN]: inCommand,
  [BotChatInputCommandName.STATISTICS]: statisticsCommand,
  [BotChatInputCommandName.SUBTRACT]: subtractCommand,
  [BotChatInputCommandName.UNIX]: unixCommand,
  [BotChatInputCommandName.SNOWFLAKE]: snowflakeCommand,
  [BotChatInputCommandName.ISO]: isoCommand,
  [BotChatInputCommandName.SETTINGS]: settingsCommand,
  [BotChatInputCommandName.API]: apiCommand,
  [BotChatInputCommandName.AT12]: at12Command,
  [BotChatInputCommandName.FAQ]: faqCommand,
};

export const chatInputCommandNames = (Object.keys(chatInputCommandMap) as BotChatInputCommandName[]);

export const isKnownChatInputCommand = (commandName: string): commandName is BotChatInputCommandName => commandName in chatInputCommandMap;

export const isKnownChatInputCommandInteraction = <InteractionType extends ChatInputCommandInteraction | AutocompleteInteraction>(interaction: InteractionType): interaction is InteractionType & {
  commandName: BotChatInputCommandName
} => isKnownChatInputCommand(interaction.commandName);
