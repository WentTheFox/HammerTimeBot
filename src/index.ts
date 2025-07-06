import { ShardingManager } from 'discord.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { env } from './env.js';
import { Logger } from './classes/logger.js';
import { updateBotTimezonesInApi, updateCommands } from './utils/backend-api-data-updaters.js';
import { InteractionHandlerContext } from './types/bot-interaction.js';
import { NestableLogger } from './types/logger-types.js';
import { createResolvablePromise } from './utils/resolvable-promise.js';
import { initI18next } from './constants/locales.js';
import { getApplicationEmojis } from './utils/get-application-emojis.js';

// This file is the main entry point that starts the bot

async function startupCommandsUpdate(logger: NestableLogger): Promise<void[]> {
  logger.log('Startup commands update');
  const i18next = await initI18next(logger);
  const context: InteractionHandlerContext = {
    commandIdMap: createResolvablePromise(),
    logger: logger.nest('startupCommandsUpdate'),
    emojiIdMap: await getApplicationEmojis({ logger }),
    i18next,
  };

  return Promise.all([
    updateCommands(context),
    updateBotTimezonesInApi(context),
  ]);
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
