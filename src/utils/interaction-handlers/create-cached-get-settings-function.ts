import { LoggerContext, UserInteractionContext } from '../../types/bot-interaction.js';
import { getSettings, SettingsValue } from '../settings.js';

export type InteractionForGetSettings = {
  user: { id: string }
};
export const createCachedGetSettingsFunction = (
  context: LoggerContext,
  interaction: InteractionForGetSettings,
): UserInteractionContext['getSettings'] => {
  let promiseCache: Promise<SettingsValue> | undefined;
  return () => {
    if (!promiseCache) {
      context.logger.debug(`Caching settings for user ${interaction.user.id} for this interaction`);
      promiseCache = getSettings(context, interaction.user.id);
    } else {
      context.logger.debug(`Re-using cached settings for user ${interaction.user.id} for this interaction`);
    }
    return promiseCache;
  };
};
