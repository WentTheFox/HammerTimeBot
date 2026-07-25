import { Snowflake } from 'discord-api-types/globals';
import {
  APIApplicationCommandOption,
  ApplicationIntegrationType,
  InteractionContextType,
  RESTPostAPIApplicationCommandsJSONBody as ApplicationCommand,
  RESTPostAPIApplicationGuildCommandsJSONBody as ApplicationGuildCommand,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  RESTPutAPIApplicationCommandsResult,
  RESTPutAPIApplicationGuildCommandsResult,
} from 'discord-api-types/v10';
import { Ajv } from 'ajv';
import { buildApplicationCommandsBody, createCommandRegistrar } from '@went.tf/discord-bot-framework/commands';
import {
  parseCommandsFile,
  registerFrameworkSchemas,
  resolveCommandsSchemaRefs,
  CommandsFile,
} from '@went.tf/discord-bot-framework/commands/schema';
import { createCommandLocalizer } from '@went.tf/discord-bot-framework/i18n';
import commandsSchemaRaw from '../commands.schema.json' with { type: 'json' };
import commandsData from '../commands.json' with { type: 'json' };
import { env } from '../env.js';
import { rest } from './rest.js';
import { getLocalizedObject } from './get-localized-object.js';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from '../constants/locales.js';
import { InteractionContext, LoggerContext } from '../types/bot-interaction.js';
import { GlobalCommandOptionName } from '../types/localization.js';
import { updateBotCommandsInApi } from './backend-api-data-updaters.js';
import { chatInputCommandRegistry, contextMenuCommandRegistry } from './interactions/registries.js';

export type BotCommandItem = (ApplicationGuildCommand & ApplicationCommand);
export type BotCommands = BotCommandItem[];

const commandsSchema = resolveCommandsSchemaRefs(commandsSchemaRaw);
const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
registerFrameworkSchemas(ajv);
const validate = ajv.compile(commandsSchema);
const commandsFile = parseCommandsFile<CommandsFile>(commandsData, { validate });

const commonCommandOptions: Pick<RESTPostAPIChatInputApplicationCommandsJSONBody, 'integration_types' | 'contexts'> = {
  integration_types: [ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall],
  contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
};

// The framework's commands.json choice schema is English-only by design - choice
// name_localizations aren't authored by hand, so the format/columns choices shared
// across most commands are localized here after the body is built.
const localizeOptionChoices = (options: APIApplicationCommandOption[] | undefined, t: InteractionContext['t']): void => {
  if (!options) return;
  for (const option of options) {
    if ((option.name === GlobalCommandOptionName.FORMAT || option.name === GlobalCommandOptionName.COLUMNS) && 'choices' in option && option.choices) {
      option.choices = option.choices.map((choice) => ({
        ...choice,
        ...getLocalizedObject('name', (lng) => t(`commands.global.options.${option.name}.choices.${choice.value}`, { lng }), true, false),
      })) as typeof option.choices;
    }
    if ('options' in option && option.options) {
      localizeOptionChoices(option.options, t);
    }
  }
};

// format/header/columns/ephemeral/timezone are shared across most commands and only
// translated once, under `commands.global.options.<name>`, not per-command.
const GLOBAL_OPTION_NAMES = new Set<string>([
  GlobalCommandOptionName.FORMAT,
  GlobalCommandOptionName.HEADER,
  GlobalCommandOptionName.COLUMNS,
  GlobalCommandOptionName.EPHEMERAL,
  GlobalCommandOptionName.TIMEZONE,
]);

const toGlobalOptionPath = (path: readonly string[]): readonly string[] =>
  (path[0] === 'commands' && path[2] === 'options' && GLOBAL_OPTION_NAMES.has(path[3]))
    ? ['commands', 'global', 'options', path[3], path[4]]
    : path;

const CONTEXT_MENU_NAMES = new Set<string>(contextMenuCommandRegistry.names);

const buildCommandsBody = (t: InteractionContext['t']): BotCommands => {
  const localizer = createCommandLocalizer({ locales: SUPPORTED_LANGUAGES, baseLocale: DEFAULT_LANGUAGE, t });
  const sanitizeName = (value: string) => value.toLowerCase().replace(/[\s（）.]/g, '-').replace(/-+$/, '');
  const localizeNames = (path: readonly string[]) => {
    const localized = localizer.localizeName(toGlobalOptionPath(path));
    if (!localized) return undefined;
    // Context-menu command names (e.g. "Message Sent") keep spaces/casing - only
    // CHAT_INPUT command/option names need Discord's lowercase-slug sanitization.
    if (CONTEXT_MENU_NAMES.has(path[1])) return localized;
    return Object.fromEntries(Object.entries(localized).map(([locale, value]) => [locale, sanitizeName(value)]));
  };

  const body = buildApplicationCommandsBody(
    commandsFile,
    { chatInput: chatInputCommandRegistry, contextMenu: contextMenuCommandRegistry },
    {
      sharedMetadata: commonCommandOptions,
      resolveDescription: (path) => localizer.resolveDescription(toGlobalOptionPath(path)),
      localizeNames,
      localizeDescriptions: (path) => localizer.localizeDescription(toGlobalOptionPath(path)),
    },
  ) as BotCommands;

  for (const command of body) {
    if ('options' in command && command.options) {
      localizeOptionChoices(command.options, t);
    }
  }

  return body;
};

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
