import { Snowflake } from 'discord-api-types/globals';
import {
  ApplicationIntegrationType,
  InteractionContextType,
  RESTPostAPIApplicationCommandsJSONBody as ApplicationCommand,
  RESTPostAPIApplicationGuildCommandsJSONBody as ApplicationGuildCommand,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  RESTPutAPIApplicationCommandsResult,
  RESTPutAPIApplicationGuildCommandsResult,
} from 'discord-api-types/v10';
import { buildApplicationCommandsBody, createCommandRegistrar } from '@wentthefox-org/discord-bot-framework/commands';
import { env } from '../env.js';
import { rest } from './rest.js';
import { InteractionContext, LoggerContext } from '../types/bot-interaction.js';
import { updateBotCommandsInApi } from './backend-api-data-updaters.js';
import { chatInputCommandRegistry, contextMenuCommandRegistry } from './interactions/registries.js';

export type BotCommandItem = (ApplicationGuildCommand & ApplicationCommand);
export type BotCommands = BotCommandItem[];

const commonCommandOptions: Pick<RESTPostAPIChatInputApplicationCommandsJSONBody, 'integration_types' | 'contexts'> = {
  integration_types: [ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall],
  contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
};

const buildCommandsBody = (t: InteractionContext['t']): BotCommands => buildApplicationCommandsBody(
  { chatInput: chatInputCommandRegistry, contextMenu: contextMenuCommandRegistry },
  { sharedMetadata: commonCommandOptions, definitionArg: t },
) as BotCommands;

const createRegistrar = (logger: LoggerContext['logger']) => createCommandRegistrar({
  rest,
  applicationId: env.DISCORD_CLIENT_ID,
  logger,
});

export const getAuthorizedServers = async (context: LoggerContext): Promise<string[]> => createRegistrar(context.logger).getAuthorizedServers();

export const updateGuildCommands = async (context: InteractionContext, guildId: Snowflake): Promise<RESTPutAPIApplicationGuildCommandsResult | undefined> => {
  const body = buildCommandsBody(context.t);
  const result = await createRegistrar(context.logger).updateGuildCommands(guildId, body);

  void updateBotCommandsInApi(context, body, result);

  return result;
};

export const cleanGuildCommands = async (context: LoggerContext, guildId: Snowflake): Promise<void> => {
  await createRegistrar(context.logger).cleanGuildCommands(guildId);
};

export const updateGlobalCommands = async (context: InteractionContext): Promise<RESTPutAPIApplicationCommandsResult | undefined> => {
  const body = buildCommandsBody(context.t);
  const result = await createRegistrar(context.logger).updateGlobalCommands(body);

  void updateBotCommandsInApi(context, body, result);

  return result;
};

export const cleanGlobalCommands = async (context: InteractionContext): Promise<void> => {
  await createRegistrar(context.logger).cleanGlobalCommands();
};
