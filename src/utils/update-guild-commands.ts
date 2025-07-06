import {
  RESTGetAPICurrentUserGuildsResult,
  RESTPutAPIApplicationCommandsResult,
  RESTPutAPIApplicationGuildCommandsResult,
  Routes,
} from 'discord-api-types/v10';
import { Snowflake } from 'discord-api-types/globals';
import { env } from '../env.js';
import { BotCommands, getApplicationCommands } from './get-application-commands.js';
import { rest } from './rest.js';
import { InteractionContext, LoggerContext } from '../types/bot-interaction.js';
import { updateBotCommandsInApi } from './backend-api-data-updaters.js';

export const getAuthorizedServers = async (context: LoggerContext): Promise<string[]> => {
  const logger = context.logger.nest('getAuthorizedServers');
  logger.log('Getting authorized servers…');
  const guilds = await rest.get(
    Routes.userGuilds(),
  ) as RESTGetAPICurrentUserGuildsResult;
  logger.log(`Found ${guilds.length} authorized server${guilds.length === 1 ? '' : 's'}`);
  return guilds.map((guild) => guild.id);
};

export const updateGuildCommands = async (context: InteractionContext, guildId: Snowflake): Promise<RESTPutAPIApplicationGuildCommandsResult | undefined> => {
  const { t } = context;
  const logger = context.logger.nest(['updateGuildCommands', `Guild#${guildId}`]);
  let result: RESTPutAPIApplicationGuildCommandsResult | undefined;
  let body: BotCommands | undefined;
  try {
    logger.log('Started reloading guild commands');

    body = getApplicationCommands(t);
    result = await rest.put(
      Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, guildId),
      { body },
    ) as RESTPutAPIApplicationGuildCommandsResult;

    logger.log('Successfully reloaded guild commands');
  } catch (error) {
    logger.error('Failed to reload guild commands', error);
    process.exit(1);
  }

  void updateBotCommandsInApi(context, body, result);

  return result;
};

export const cleanGuildCommands = async (context: LoggerContext, guildId: Snowflake): Promise<void> => {
  const logger = context.logger.nest(['cleanGuildCommands', `Guild#${guildId}`]);
  try {
    logger.log('Started cleaning guild commands');

    await rest.put(
      Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, guildId),
      { body: [] },
    );

    logger.log('Successfully cleaned guild commands');
  } catch (error) {
    logger.error('Failed to clean guild commands', error);
    process.exit(1);
  }
};

export const updateGlobalCommands = async (context: InteractionContext): Promise<RESTPutAPIApplicationCommandsResult | undefined> => {
  const { t } = context;
  const logger = context.logger.nest('updateGlobalCommands');
  let result: RESTPutAPIApplicationCommandsResult | undefined;
  let body: BotCommands | undefined;
  try {
    logger.log('Started refreshing application commands');

    body = getApplicationCommands(t);
    result = await rest.put(
      Routes.applicationCommands(env.DISCORD_CLIENT_ID),
      { body },
    ) as RESTPutAPIApplicationCommandsResult;

    logger.log('Successfully reloaded application commands');
  } catch (error) {
    logger.error('Failed to reload application commands', error);
    process.exit(1);
  }

  void updateBotCommandsInApi(context, body, result);

  return result;
};

export const cleanGlobalCommands = async (context: InteractionContext): Promise<void> => {
  const logger = context.logger.nest('cleanGlobalCommands');
  try {
    logger.log('Started cleaning application commands');

    await rest.put(
      Routes.applicationCommands(env.DISCORD_CLIENT_ID),
      { body: [] },
    );

    logger.log('Successfully cleaned application commands');
  } catch (error) {
    logger.error('Failed to clean application commands', error);
    process.exit(1);
  }
};
