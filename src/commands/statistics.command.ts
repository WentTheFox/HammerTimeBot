import { BotChatInputCommand, BotChatInputCommandName } from '../types/bot-interaction.js';
import { MessageTimestamp, MessageTimestampFormat } from '../classes/message-timestamp.js';
import { EPHEMERAL_OPTION_DEFAULT_VALUE, getBareNumberFormatter, isEphemeralResponse } from '../utils/messaging.js';
import { env } from '../env.js';
import { MessageFlags } from 'discord-api-types/v10';
import { CROWDIN_PROJECT_URL, SUPPORTED_LANGUAGES } from '../constants/locales.js';
import { getProcessStartTs } from '../utils/get-process-start-ts.js';
import { DiscordjsErrorCodes } from 'discord.js';

export const statisticsCommand: BotChatInputCommand = {
  name: BotChatInputCommandName.STATISTICS,
  async handle(interaction, context) {
    const settings = await context.getSettings();
    const ephemeral = isEphemeralResponse(interaction, settings);
    await interaction.deferReply({ flags: ephemeral ?? EPHEMERAL_OPTION_DEFAULT_VALUE ? MessageFlags.Ephemeral : undefined });

    const { t } = context;
    const { shard } = interaction.client;
    const shardStartTs = new MessageTimestamp(getProcessStartTs());
    const numberFormatter = getBareNumberFormatter(interaction, context);

    const shardServersJoined = interaction.client.guilds.cache.size;
    let totalServersJoined: number | null = null;
    try {
      const guildsCacheSizes = await shard?.fetchClientValues('guilds.cache.size');
      totalServersJoined = typeof guildsCacheSizes !== 'undefined'
        ? guildsCacheSizes.reduce(
          (acc: number, guildCount) => typeof guildCount === 'number' ? acc + guildCount : acc,
          0,
        )
        : shardServersJoined;
    } catch (e) {
      if (typeof e === 'object' && e !== null && 'code' in e && e.code === DiscordjsErrorCodes.ShardingInProcess) {
        // Ignore error, this stat will be skipped
      } else {
        throw e;
      }
    }

    const totalServerCount = totalServersJoined !== null ? `**${t('commands.statistics.responses.totalServerCount')}** ${numberFormatter.format(totalServersJoined)}` : null;
    const shardServerCount = shard ? `**${t('commands.statistics.responses.shardServerCount')}** ${numberFormatter.format(shardServersJoined)}` : null;
    const uptime = `**${t('commands.statistics.responses.uptime')}** ${shardStartTs.toString(MessageTimestampFormat.RELATIVE)}`;
    const shardCount = shard ? `**${t('commands.statistics.responses.shardCount')}** ${numberFormatter.format(shard.count)}` : null;
    const footer = `*${shard ? t('commands.statistics.responses.shardNumber', { replace: { shardId: shard?.ids.join(', ') } }) : t('commands.statistics.responses.noShards')}*`;
    const serverInvite = `**${t('commands.statistics.responses.serverInvite')}** ${env.DISCORD_INVITE_URL}`;
    const supportedLanguages = `**${t('commands.statistics.responses.supportedLanguages')}** ${SUPPORTED_LANGUAGES.length}`;
    const crowdinProject = `**${t('commands.statistics.responses.crowdinProject')}** <${CROWDIN_PROJECT_URL}>`;

    const content = [
      totalServerCount,
      shardServerCount,
      uptime,
      shardCount,
      '',
      footer,
      // Keep these last to align with the invite embed shown below the message
      '',
      supportedLanguages,
      crowdinProject,
      serverInvite,
    ].filter(el => el !== null).join('\n');

    await interaction.editReply({
      content,
    });
  },
};
