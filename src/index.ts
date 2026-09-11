import { ShardingManager } from 'discord.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { env } from './env.js';
import { Logger } from './classes/logger.js';
import { syncStartupData } from './utils/sync-startup-data.js';

// This file is the main entry point that starts the bot

(async function createShards() {
  const logger = new Logger('ShardingManager');
  await syncStartupData(logger);

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

  registerGracefulRespawnTrigger(manager, logger);
})();

/**
 * SIGUSR2 is sent by the deploy hook after a fresh build lands on disk, so a deploy can pick up
 * shard-side code changes by respawning shards one at a time instead of killing the whole
 * process (which would take every shard down for the entire respawn duration, ~2 minutes with
 * our current shard count). This does NOT reload this file (src/index.ts) or its own
 * dependencies, only what each shard process (bot.js) imports fresh on respawn - the deploy hook
 * still falls back to a full `pm2 restart` when index.ts, package.json or the lockfile change.
 */
function registerGracefulRespawnTrigger(manager: ShardingManager, logger: Logger): void {
  let respawnInProgress = false;

  process.on('SIGUSR2', () => {
    if (respawnInProgress) {
      logger.warn('Received SIGUSR2 while a respawn was already in progress, ignoring');
      return;
    }

    respawnInProgress = true;
    logger.log('Received SIGUSR2, gracefully respawning all shards…');
    const start = Date.now();
    manager.respawnAll()
      .then(() => {
        logger.log(`All shards respawned in ${Date.now() - start}ms`);
      })
      .catch((e) => {
        logger.error('Failed to respawn all shards', e);
      })
      .finally(() => {
        respawnInProgress = false;
      });
  });
}
