import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createShardManager } from '@wentthefox-org/discord-bot-framework/client';
import { env } from './env.js';
import { syncStartupData } from './utils/sync-startup-data.js';
import { createAppLogger } from './utils/create-app-logger.js';

// This file is the main entry point that starts the bot

(async function createShards() {
  const logger = createAppLogger('ShardingManager');
  const currentFolder = dirname(fileURLToPath(import.meta.url));
  const botScriptPath = `${currentFolder}/bot.js`;

  await createShardManager({
    token: env.DISCORD_BOT_TOKEN,
    botScriptPath,
    logger,
    beforeSpawn: () => syncStartupData(logger),
  });
})();
