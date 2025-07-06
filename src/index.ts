import { ShardingManager } from 'discord.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { env } from './env.js';
import { Logger } from './classes/logger.js';
import { updateBotTimezonesInApi, updateCommands } from './utils/backend-api-data-updaters.js';
import { InteractionHandlerContext } from './types/bot-interaction.js';
import { NestableLogger } from './types/logger-types.js';
import { initI18next } from './constants/locales.js';
import { getEmojiIdMap } from './utils/get-emoji-id-map.js';
import { getCommandIdMap } from './utils/get-command-id-map.js';

// This file is the main entry point that starts the bot

async function startupCommandsUpdate(parentLogger: NestableLogger): Promise<void> {
  const logger = parentLogger.nest('startupCommandsUpdate');
  logger.log('Updating…');
  const i18next = await initI18next(logger);
  const context: InteractionHandlerContext = {
    commandIdMap: await getCommandIdMap({ logger }),
    logger,
    emojiIdMap: await getEmojiIdMap({ logger }),
    i18next,
  };

  await Promise.all([
    updateCommands(context),
    updateBotTimezonesInApi(context),
  ]);

  logger.log('Completed.');
}

(async function createShards() {
  const logger = new Logger('ShardingManager');
  await startupCommandsUpdate(logger);

  const currentFolder = dirname(fileURLToPath(import.meta.url));
  const botScriptPath = `${currentFolder}/bot.js`;

  logger.log(`Starting recommended number of shards with path ${botScriptPath}`);
  const manager = new ShardingManager(botScriptPath, { token: env.DISCORD_BOT_TOKEN });

  manager.on('shardCreate', shard => {
    logger.log(`Shard ${shard.id} created`);

    shard.on('spawn', () => {
      logger.log(`Shard ${shard.id} spawned`);
    });
    shard.on('ready', () => {
      logger.log(`Shard ${shard.id} ready`);
    });
    shard.on('disconnect', () => {
      logger.log(`Shard ${shard.id} disconnected`);
    });
    shard.on('reconnecting', () => {
      logger.log(`Shard ${shard.id} reconnecting`);
    });
    shard.on('death', () => {
      logger.log(`Shard ${shard.id} died`);
    });
  });
  await manager.spawn();
})();
