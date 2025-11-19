import { BotMessageComponent, BotMessageComponentCustomId } from '../types/bot-interaction.js';
import { ComponentType, MessageComponentInteraction, StringSelectMenuInteraction } from 'discord.js';
import { TFunction } from 'i18next';
import { MessageTimestamp, MessageTimestampFormat } from '../classes/message-timestamp.js';
import { APISelectMenuOption } from 'discord-api-types/v9';
import { MessageFlags } from 'discord-api-types/v10';
import { findTextComponentContentsRecursively } from '../utils/messaging.js';
import { extractTimestampsFromStrings } from '../utils/extract-timestamps-from-strings.js';

const getFormatSelectOptions = (t: TFunction, emojiIdMap: Record<string, string>): APISelectMenuOption[] =>
  [
    MessageTimestampFormat.SHORT_DATE,
    MessageTimestampFormat.LONG_DATE,
    MessageTimestampFormat.SHORT_TIME,
    MessageTimestampFormat.LONG_TIME,
    MessageTimestampFormat.SHORT_FULL,
    MessageTimestampFormat.LONG_FULL,
    MessageTimestampFormat.SHORT_COMPACT,
    MessageTimestampFormat.LONG_COMPACT,
    MessageTimestampFormat.RELATIVE,
  ].map((value) => {
    const emojiName = `format${value}`;
    const emojiId = emojiIdMap[emojiName];
    return ({
      value,
      label: t(`commands.global.options.format.choices.${value}`),
      emoji: emojiId ? { name: emojiName, id: emojiIdMap[emojiName] } : undefined,
    });
  });

const isStringSelectInteraction = (interaction: Pick<MessageComponentInteraction, 'componentType'>): interaction is StringSelectMenuInteraction => interaction.componentType === ComponentType.StringSelect;

const getSyntaxReplyContent = (interaction: MessageComponentInteraction): string => {
  return findTextComponentContentsRecursively(interaction.message.components).join('\n') || interaction.message.content;
};

export const formatSelectComponent: BotMessageComponent = {
  getDefinition: (t, customEmojiIds) => ({
    type: ComponentType.StringSelect,
    custom_id: BotMessageComponentCustomId.FORMAT_SELECT,
    options: getFormatSelectOptions(t, customEmojiIds),
  }),
  async handle(interaction) {
    if (!isStringSelectInteraction(interaction)) {
      throw new Error('String select interaction expected');
    }

    const format = interaction.values[0] as MessageTimestampFormat;
    if (!format) {
      throw new Error('No format specified');
    }

    const syntaxReplyContent = getSyntaxReplyContent(interaction);
    const timestamps = extractTimestampsFromStrings(syntaxReplyContent);
    if (timestamps.length === 0) {
      throw new Error(`No timestamp could be found in the original message (${JSON.stringify(syntaxReplyContent)})`);
    }

    const unixTimestamp = timestamps[0].replace(/[^\d-]/g, '');
    const content = MessageTimestamp.fromTimestamp(unixTimestamp, format);

    if (interaction.replied) {
      await interaction.editReply({
        content,
      });
    }

    await interaction.reply({
      content,
      flags: MessageFlags.Ephemeral,
    });
  },
};
