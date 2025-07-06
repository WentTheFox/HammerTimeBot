import { rest } from './rest.js';
import {
  RESTGetAPIApplicationCommandsResult,
  RESTGetAPIApplicationGuildCommandResult,
  Routes,
} from 'discord-api-types/v10';
import { env } from '../env.js';
import { NestableLogger } from '../types/logger-types.js';
import { getAuthorizedServers } from './update-guild-commands.js';

export const getCommandIdMap = async (context: { logger: NestableLogger }): Promise<Record<string, string>> => {
  const logger = context.logger.nest('getCommandIdMap');
  let commandsResponse: RESTGetAPIApplicationCommandsResult | RESTGetAPIApplicationGuildCommandResult;
  if (env.LOCAL) {
    const authorizedServers = await getAuthorizedServers({ logger });
    if (authorizedServers.length > 1) {
      throw new Error(`More than one authorized server was found: ${authorizedServers.join(', ')}`);
    }
    const guildId = authorizedServers[0];
    logger.log(`Getting guild commands for guild ${guildId}…`);
    commandsResponse = await rest.get(
      Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, guildId),
    ) as RESTGetAPIApplicationCommandsResult;
  } else {
    logger.log('Getting application commands…');
    commandsResponse = await rest.get(
      Routes.applicationCommands(env.DISCORD_CLIENT_ID),
    ) as RESTGetAPIApplicationCommandsResult;
  }
  logger.log(`Found ${commandsResponse.length} command${commandsResponse.length === 1 ? '' : 's'}`);
  return commandsResponse.reduce((acc, { name, id }) => name && id ? {
    ...acc,
    [name]: id,
  } : acc, {} as Record<string, string>);
};
