import { updateBotTimezonesInApi, updateCommands, updateFaqEntriesInApi } from './backend-api-data-updaters.js';
import { InteractionHandlerContext } from '../types/bot-interaction.js';
import { ILogger } from '../types/logger-types.js';
import { initI18next } from '../constants/locales.js';
import { env } from '../env.js';
import { getEmojiIdMap } from './get-emoji-id-map.js';
import { getCommandIdMap } from './get-command-id-map.js';
import { syncGlobalCommands } from './sync-global-commands.js';

export interface SyncStartupDataOptions {
  /** Re-register global commands even if they're unchanged since the last successful update */
  forceCommandUpdate?: boolean;
}

/**
 * Registers the current slash/context-menu commands with Discord and syncs FAQ/timezone data with
 * the backend API. Run by the deploy hook as a one-off step on every deploy, separately from the
 * long-lived webhook.js process. Each step is independent: one failing doesn't cut the others short,
 * but still makes the process exit non-zero once they've all finished.
 */
export async function syncStartupData(parentLogger: ILogger, { forceCommandUpdate = false }: SyncStartupDataOptions = {}): Promise<void> {
  const logger = parentLogger.nest('syncStartupData');
  logger.log('Updating…');
  const i18next = await initI18next(logger);
  const context: InteractionHandlerContext = {
    commandIdMap: await getCommandIdMap({ logger }),
    logger,
    emojiIdMap: await getEmojiIdMap({ logger }),
    i18next,
    isWebhookMode: false,
  };

  const steps: Array<[string, Promise<unknown>]> = [
    [
      'commands',
      env.LOCAL
        ? updateCommands(context)
        : syncGlobalCommands({ ...context, t: i18next.t.bind(i18next) }, { force: forceCommandUpdate }),
    ],
    ['timezones', updateBotTimezonesInApi(context)],
    ['FAQ entries', updateFaqEntriesInApi(context)],
  ];
  const results = await Promise.allSettled(steps.map(([, step]) => step));

  const failedSteps = results.flatMap((result, i) => {
    if (result.status === 'fulfilled') return [];
    logger.error(`Failed to sync ${steps[i][0]}`, result.reason);
    return [steps[i][0]];
  });
  if (failedSteps.length > 0) {
    process.exitCode = 1;
    logger.log(`Completed with failures (${failedSteps.join(', ')}).`);
    return;
  }

  logger.log('Completed.');
}
