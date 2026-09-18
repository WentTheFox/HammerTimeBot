import { SettingName } from '../types/setting-name.js';
import { env } from '../env.js';
import { MessageTimestampFormat } from '../classes/message-timestamp.js';
import { ResponseColumnChoices } from '../types/localization.js';
import typia from 'typia';
import { backendApiRequest } from './backend-api-request.js';
import { LoggerContext } from '../types/bot-interaction.js';

export interface SettingsValue {
  [SettingName.ephemeral]: boolean | null;
  [SettingName.timezone]: string | null;
  [SettingName.header]: boolean | null,
  [SettingName.boldPreview]: boolean | null,
  [SettingName.columns]: ResponseColumnChoices | null,
  [SettingName.format]: MessageTimestampFormat | null,
  [SettingName.formatMinimalReply]: boolean | null,
  [SettingName.telemetry]: boolean | null,
  [SettingName.defaultAtHour]: number | null,
  [SettingName.defaultAt12Hour]: number | null,
  [SettingName.defaultAtMinute]: number | null,
  [SettingName.defaultAtSecond]: number | null,
}

const defaultSettings: { [k in SettingName]: SettingsValue[k] } = {
  [SettingName.ephemeral]: null,
  [SettingName.timezone]: null,
  [SettingName.header]: null,
  [SettingName.boldPreview]: null,
  [SettingName.columns]: null,
  [SettingName.format]: null,
  [SettingName.formatMinimalReply]: null,
  [SettingName.defaultAtHour]: null,
  [SettingName.defaultAt12Hour]: null,
  [SettingName.defaultAtMinute]: null,
  [SettingName.defaultAtSecond]: 0,
  [SettingName.telemetry]: true,
};

export const getSettings = async (
  context: LoggerContext,
  userId: string,
): Promise<SettingsValue> => {
  const { logger } = context;
  if (env.DISABLE_SETTINGS) {
    logger.debug(`Settings are disabled, falling back to default settings for user ${userId}`);
    return defaultSettings;
  }

  // Timed and logged either way (not just on failure) so we actually have production latency
  // samples to look at next time this comes up - see backend-api-request.ts's timeoutMs doc for why
  // 1s: nothing here previously bounded how long a hung settings fetch could block an interaction
  // that's on Discord's 3s response-time budget.
  const startedAt = Date.now();
  try {
    const { ok, status, response, responseText } = await backendApiRequest(context, {
      path: `/settings/${userId}`,
      validator: typia.createValidate<SettingsValue>(),
      timeoutMs: 1000,
    });

    if (!ok) {
      // backendApiRequest only throws for non-HTTP failures (network error, timeout) - an actual
      // HTTP error status (hit in practice: a 503 while the backend was mid-deploy) resolves
      // normally with response: undefined instead, so this needs its own check rather than relying
      // on the catch below. Missing this previously let `undefined` through as if it were a real
      // SettingsValue, which crashed the first caller that read a property off it.
      logger.error(`Falling back to default settings for user ${userId} after ${Date.now() - startedAt}ms (status ${status})`);
      return defaultSettings;
    }

    logger.debug(`Fetched settings for user ${userId} in ${Date.now() - startedAt}ms`);

    if (env.LOCAL) {
      logger.debug(`Fetched settings for user ${userId}: ${responseText}`);
    }

    return response;
  } catch (e) {
    logger.error(`Falling back to default settings for user ${userId} after ${Date.now() - startedAt}ms due to request error`, e);
    return defaultSettings;
  }
};
