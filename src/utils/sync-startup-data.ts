import { updateBotTimezonesInApi, updateCommands, updateFaqEntriesInApi } from './backend-api-data-updaters.js';
import { InteractionHandlerContext } from '../types/bot-interaction.js';
import { ILogger } from '../types/logger-types.js';
import { initI18next } from '../constants/locales.js';
import { getEmojiIdMap } from './get-emoji-id-map.js';
import { getCommandIdMap } from './get-command-id-map.js';

/**
 * Registers the current slash/context-menu commands with Discord and syncs FAQ/timezone data with
 * the backend API. This is decoupled from the ShardingManager process (src/index.ts) so the deploy
 * hook can run it as a one-off step on every deploy, regardless of whether the manager itself gets
 * restarted or shards are just gracefully respawned in place.
 */
export async function syncStartupData(parentLogger: ILogger): Promise<void> {
  const logger = parentLogger.nest('syncStartupData');
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
    updateFaqEntriesInApi(context),
  ]);

  logger.log('Completed.');
}
