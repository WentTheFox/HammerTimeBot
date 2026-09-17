import { Client, InteractionType, MessageFlags } from 'discord.js';
import { createBotClient } from '@went.tf/discord-bot-framework/client';
import { getGitData } from '@went.tf/discord-bot-framework/utils';
import {
  dispatchAutocomplete,
  dispatchChatInputCommand,
  dispatchComponent,
  dispatchContextMenu,
  OnDispatchError,
} from '@went.tf/discord-bot-framework/interactions';
import { env } from '../env.js';
import { InteractionHandlerContext, UserInteractionContext } from '../types/bot-interaction.js';

import { sendCommandTelemetry } from './backend-api-data-updaters.js';
import { addTelemetryNoteToReply } from './add-telemetry-note-to-reply.js';
import { buildUserInteractionContext } from './build-user-interaction-context.js';
import { handleInteractionError } from './interaction-handlers/handle-interaction-error.js';
import { interactionReply } from './interaction-reply.js';
import { chatInputCommandRegistry, componentRegistry, contextMenuCommandRegistry } from './interactions/registries.js';
import { getUserIdentifier, stringifyChannelName, stringifyGuildName, stringifyOptionsData } from './messaging.js';

const handleReady = (context: InteractionHandlerContext) => async (client: Client<true>) => {
  const { logger } = context;
  const clientUser = client.user;
  if (!clientUser) throw new Error('Expected `client.user` to be defined');
  logger.log(`Logged in as ${clientUser.tag}!`);

  const versionString = env.LOCAL ? 'a local version' : await getGitData(context)
    .then(({ hash }) => `version ${hash}`)
    .catch(() => 'an unknown version');
  clientUser.setActivity(versionString);
};

const onError: OnDispatchError<UserInteractionContext> = async (interaction, context) => {
  await handleInteractionError(interaction as Parameters<typeof handleInteractionError>[0], context);
};

export const createClient = async (context: InteractionHandlerContext): Promise<void> => {
  await createBotClient({
    intents: [],
    token: env.DISCORD_BOT_TOKEN,
    onReady: handleReady(context),
    onInteraction: async (interaction) => {
      const userInteractionContext = await buildUserInteractionContext(interaction, context);
      const { logger } = userInteractionContext;

      if (interaction.isChatInputCommand()) {
        const { commandName, user, options, channel, channelId, guild, guildId } = interaction;
        const optionsString = options.data.length > 0 ? ` ${stringifyOptionsData(options.data)}` : '';
        logger.log(`${getUserIdentifier(user)} ran /${commandName}${optionsString} in ${stringifyChannelName(channelId, channel)} of ${stringifyGuildName(guildId, guild)}`);

        await dispatchChatInputCommand(interaction, userInteractionContext, {
          commands: chatInputCommandRegistry.byName,
          onUnknownCommand: async (i) => {
            await interactionReply(userInteractionContext, i, { content: `Unknown command ${i.commandName}` });
          },
          onError,
        });

        void sendCommandTelemetry(userInteractionContext, interaction)
          .then((telemetryResponse) => addTelemetryNoteToReply(userInteractionContext, interaction, telemetryResponse));
        return;
      }

      if (interaction.isAutocomplete()) {
        await dispatchAutocomplete(interaction, userInteractionContext, {
          commands: chatInputCommandRegistry.byName,
          onError,
        });
        return;
      }

      if (interaction.isMessageComponent()) {
        const { customId, user, channel, channelId, guild, guildId } = interaction;
        logger.log(`${getUserIdentifier(user)} interacted with component "${customId}" in ${stringifyChannelName(channelId, channel)} of ${stringifyGuildName(guildId, guild)}`);

        await dispatchComponent(interaction, userInteractionContext, {
          components: componentRegistry.byName,
          onUnknownComponent: async (i) => {
            await interactionReply(userInteractionContext, i, {
              content: `Unsupported component interaction with customId ${i.customId}`,
              flags: MessageFlags.Ephemeral,
            });
          },
          onError,
        });
        return;
      }

      if (interaction.isMessageContextMenuCommand()) {
        const { commandName, user, channel, channelId, guild, guildId } = interaction;
        logger.log(`${getUserIdentifier(user)} ran "${commandName}" in ${stringifyChannelName(channelId, channel)} of ${stringifyGuildName(guildId, guild)}`);

        await dispatchContextMenu(interaction, userInteractionContext, {
          contextMenuCommands: contextMenuCommandRegistry.byName,
          onUnknownCommand: async (i) => {
            await interactionReply(userInteractionContext, i, {
              content: `Unsupported context menu interaction with name ${i.commandName}`,
              flags: MessageFlags.Ephemeral,
            });
          },
          onError,
        });

        void sendCommandTelemetry(userInteractionContext, interaction)
          .then((telemetryResponse) => addTelemetryNoteToReply(userInteractionContext, interaction, telemetryResponse));
        return;
      }

      if (interaction.type === InteractionType.ApplicationCommand) {
        await interactionReply(userInteractionContext, interaction, {
          content: `Unsupported command type ${interaction.commandType} when running ${interaction.commandName}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      throw new Error(`Unhandled interaction of type ${interaction.type}`);
    },
  });
};
