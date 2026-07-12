import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { Logger } from '@wentthefox-org/discord-bot-framework/logger';
import { createShardManager } from '@wentthefox-org/discord-bot-framework/client';
import { env } from './env.js';
import { syncStartupData } from './utils/sync-startup-data.js';

// This file is the main entry point that starts the bot

(async function createShards() {
  const logger = new Logger('ShardingManager');
  const currentFolder = dirname(fileURLToPath(import.meta.url));
  const botScriptPath = `${currentFolder}/bot.js`;

  await createShardManager({
    token: env.DISCORD_BOT_TOKEN,
    botScriptPath,
    logger,
    beforeSpawn: () => syncStartupData(logger),
  });
})();
