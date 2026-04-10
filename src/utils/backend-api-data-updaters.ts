import type { APIApplicationCommand, APIApplicationCommandOption } from 'discord-api-types/v10';
import { ChatInputCommandInteraction, Client, ContextMenuCommandInteraction } from 'discord.js';
import { filledBar } from 'string-progressbar';
import typia from 'typia';
import { EmojiCharacters } from '../constants/emoji-characters.js';
import { env } from '../env.js';
import { FAQ_ENTRIES } from '../faq/faq-entries.generated.js';
import {
  InteractionContext,
  InteractionHandlerContext,
  LoggerContext,
  UserSettingsContext,
} from '../types/bot-interaction.js';
import { TelemetryResponse } from './add-telemetry-note-to-reply.js';
import { backendApiRequest } from './backend-api-request.js';
import { BotCommandItem, BotCommands } from './get-application-commands.js';
import { getProcessStartTs } from './get-process-start-ts.js';
import { resolveFaqMentions } from './resolve-faq-mentions.js';
import {
  cleanGlobalCommands,
  getAuthorizedServers,
  updateGlobalCommands,
  updateGuildCommands,
} from './update-guild-commands.js';

type MinimalAPIApplicationCommand =
  Pick<APIApplicationCommand, 'id' | 'name' | 'name_localizations' | 'description' | 'description_localizations' | 'type'>
  & {
  options?: Array<Pick<APIApplicationCommandOption, 'name' | 'name_localizations' | 'description' | 'description_localizations' | 'type' | 'required'>>
};

const augmentResultWithOptions = <T extends MinimalAPIApplicationCommand[] | undefined>(input: BotCommands | undefined, result: T): T => {
  const indexedOptions = input?.reduce((acc, command) => ({
    ...acc,
    [command.name]: command.options,
  }), {} as Record<string, BotCommandItem['options']>);
  return result?.map(command => {
    if (indexedOptions?.[command.name]) {
      return {
        ...command,
        options: indexedOptions[command.name],
      };
    }
    return command;
  }) as T;
};

export const updateBotCommandsInApi = async (parentContext: LoggerContext, input: BotCommands | undefined, result: MinimalAPIApplicationCommand[] | undefined): Promise<void> => {
  if (!result) return;

  const logger = parentContext.logger.nest('updateBotCommandsInApi');
  logger.log('Updating…');
  const resultWithOptions = augmentResultWithOptions(input, result);
  try {
    await backendApiRequest({ logger }, {
      path: '/bot-commands',
      method: 'PUT',
      validator: typia.createValidate<unknown[]>(),
      body: resultWithOptions,
    });

    logger.log('Successful');
  } catch (error) {
    logger.warn('Failed', error);
  }
};

export const updateFaqEntriesInApi = async (parentContext: LoggerContext): Promise<void> => {
  const logger = parentContext.logger.nest('updateFaqEntriesInApi');
  if (!env.SUPPORT_SERVER_ID) {
    logger.warn('Skipped due to missing SUPPORT_SERVER_ID env var');
    return;
  }
  logger.log('Updating…');
  try {
    const entries = Object.values(FAQ_ENTRIES);
    const { channels, users, roles } = await resolveFaqMentions(
      entries.map((e) => e.content),
      logger,
    );
    await backendApiRequest({ logger }, {
      path: '/faq-entries',
      method: 'PUT',
      validator: typia.createValidate<unknown>(),
      body: {
        entries: entries.map((entry) => ({
          identifier: entry.id,
          topic: entry.title,
          source_text: entry.content,
        })),
        channels,
        users,
        roles,
        guild_id: env.SUPPORT_SERVER_ID,
      },
    });
    logger.log('Successful');
  } catch (error) {
    logger.warn('Failed', error);
  }
};

export const updateBotTimezonesInApi = async (parentContext: LoggerContext): Promise<void> => {
  const logger = parentContext.logger.nest('updateBotTimezonesInApi');
  const context = { ...parentContext, logger };
  logger.log('Updating…');
  try {
    await backendApiRequest(context, {
      path: '/bot-timezones',
      method: 'PUT',
      validator: typia.createValidate<unknown>(),
      body: { timezones: Intl.supportedValuesOf('timeZone') },
    });

    logger.log('Successful');
  } catch (error) {
    logger.warn('Failed', error);
  }
};

export type BasicCommandData = Array<{ id: string, name: string }>;

export const updateCommandsFromInteraction = async (interactionContext: InteractionContext, progressReporter?: (progress: string) => Promise<unknown>): Promise<BasicCommandData | undefined> => {
  interactionContext.logger.log(`Application ${env.LOCAL ? 'is' : 'is NOT'} in local mode`);
  let result: BasicCommandData | undefined;
  if (env.LOCAL) {
    await progressReporter?.('Getting authorized servers list…');
    const serverIds = await getAuthorizedServers(interactionContext);
    await progressReporter?.('Cleaning global commands…');
    await cleanGlobalCommands(interactionContext);
    const serverCount = serverIds.length;
    let completed = 0;
    const updateProgress = progressReporter ? async () => {
      const progressbar = filledBar(serverCount, completed, 18, EmojiCharacters.WHITE_SQUARE, EmojiCharacters.GREEN_SQUARE)[0];
      await progressReporter?.(`Updating server commands…\n-# ${progressbar}`);
    } : undefined;
    await Promise.all(serverIds.map(async (serverId) => {
      await updateProgress?.();
      result = await updateGuildCommands(interactionContext, serverId);
      completed++;
      await updateProgress?.();
    }));
  } else {
    await progressReporter?.('Updating global commands…');
    result = await updateGlobalCommands(interactionContext);
  }

  return result;
};

export const updateCommands = async (context: InteractionHandlerContext): Promise<void> => {
  const { i18next, ...restContext } = context;
  const logger = context.logger.nest('updateCommands');
  logger.log('Updating commands…');
  const t = i18next.t.bind(i18next);
  await updateCommandsFromInteraction({ ...restContext, t, logger });
};

export const updateShardStats = async (context: LoggerContext, client: Client, shardId: number) => {
  const logger = context.logger.nest('updateShardStats').muteMethods(['debug', 'info']);
  const serverCount = client.guilds.cache.size;
  const memberCount = client.guilds.cache.reduce((members, guild) => {
    if (members === null) return null;
    const count = guild.approximateMemberCount ?? guild.memberCount;
    return typeof count === 'number' && !isNaN(count) ? members + count : null;
  }, 0 as number | null);
  const startedAt = getProcessStartTs().toISOString();

  const body = {
    id: shardId,
    server_count: serverCount,
    member_count: memberCount,
    started_at: startedAt,
  };
  logger.debug('Shard statistics collected:', body);
  await backendApiRequest({ logger }, {
    path: '/shard-statistics',
    method: 'POST',
    body,
    validator: typia.createValidate<Record<string, unknown>>(),
    failOnInvalidResponse: false,
  });
  logger.info('Successfully updated shard statistics');
};

export const sendCommandTelemetry = async (context: LoggerContext & UserSettingsContext, interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction): Promise<TelemetryResponse | undefined | null> => {
  const logger = context.logger.nest('sendCommandTelemetry').muteMethods(['info', 'debug']);
  logger.debug('Obtaining user consent…');
  const settings = await context.getSettings();
  if (!settings.telemetry) {
    logger.debug('User consent revoked, skip sending telemetry');
    return null;
  }
  logger.info('Sending command telemetry…');
  const body = {
    locale: interaction.locale,
    commandId: interaction.commandId,
    options: interaction.options.data.map(option => ({
      name: option.name,
      type: option.type,
    })),
  };
  const result = await backendApiRequest(context, {
    path: '/command-telemetry',
    method: 'POST',
    body,
    validator: typia.createValidate<TelemetryResponse>(),
    failOnInvalidResponse: false,
  });
  if (result.ok) {
    logger.log('Successfully sent command telemetry');
  }

  return result?.response;
};
