import { Client, Events, InteractionType } from 'discord.js';
import { env } from '../env.js';
import { getGitData } from './get-git-data.js';
import {
  handleCommandAutocomplete,
  handleCommandInteraction,
  handleComponentInteraction,
} from './interaction-handlers.js';
import { InteractionHandlerContext } from '../types/bot-interaction.js';

import { updateShardStats } from './backend-api-data-updaters.js';

const FIVE_MINUTES_MS = 5 * 60 * 1e3;

const handleReady = (context: InteractionHandlerContext) => async (client: Client<true>) => {
  const { logger } = context;
  const clientUser = client.user;
  if (!clientUser) throw new Error('Expected `client.user` to be defined');
  logger.log(`Logged in as ${clientUser.tag}!`);

  const versionString = env.LOCAL ? 'a local version' : await getGitData(context)
    .then(({ hash }) => `version ${hash}`)
    .catch(() => 'an unknown version');
  clientUser.setActivity(versionString);

  const startupPromises: Promise<void>[] = [];

  const statsUpdate = async () => {
    const currentShardIds = client.shard?.ids ?? [];
    if (currentShardIds.length === 0) return;

    try {
      await Promise.all(currentShardIds.map(async (shardId) => {
        await updateShardStats(context, client, shardId);
      }));
    } catch (e) {
      logger.error('Failed to update shard statistics:', e);
    }
  };
  startupPromises.push(statsUpdate());

  // Wait for startup actions
  await Promise.all(startupPromises);

  // Set up scheduled calls
  setInterval(() => {
    void statsUpdate();
  }, FIVE_MINUTES_MS);
};

export const createClient = async (context: InteractionHandlerContext): Promise<void> => {
  const client = new Client({ intents: [] });

  client.on(Events.ClientReady, handleReady(context));

  client.on(Events.InteractionCreate, async (interaction) => {
    switch (interaction.type) {
      case InteractionType.ApplicationCommand:
        await handleCommandInteraction(interaction, context);
        return;
      case InteractionType.ApplicationCommandAutocomplete:
        await handleCommandAutocomplete(interaction, context);
        return;
      case InteractionType.MessageComponent:
        await handleComponentInteraction(interaction, context);
        return;
      default:
        throw new Error(`Unhandled interaction of type ${interaction.type}`);
    }

  });

  await client.login();
};
