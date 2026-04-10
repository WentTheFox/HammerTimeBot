import { config } from 'dotenv';

config({ quiet: true });

const {
  DISCORD_BOT_TOKEN,
  DISCORD_CLIENT_ID,
  CROWDIN_PROJECT_IDENTIFIER,
  LOCAL,
  DEBUG_I18N,
  DISABLE_SETTINGS,
  UA_STRING,
  DISCORD_INVITE_URL,
  API_URL,
  API_TOKEN,
  SUPPORT_SERVER_ID,
} = process.env;

/**
 * Type-safe process.env
 */
export const env = (() => {
  const values = {
    DISCORD_BOT_TOKEN,
    DISCORD_CLIENT_ID,
    CROWDIN_PROJECT_IDENTIFIER: CROWDIN_PROJECT_IDENTIFIER ?? '',
    LOCAL: typeof LOCAL !== 'undefined' && LOCAL === 'true',
    DEBUG_I18N: typeof DEBUG_I18N !== 'undefined' && DEBUG_I18N === 'true',
    DISABLE_SETTINGS: typeof DISABLE_SETTINGS !== 'undefined' && DISABLE_SETTINGS === 'true',
    UA_STRING,
    DISCORD_INVITE_URL,
    API_URL,
    API_TOKEN,
    /** Server ID used to resolve role mentions in FAQ entries. Optional. */
    SUPPORT_SERVER_ID: SUPPORT_SERVER_ID ?? '',
  };

  type Values = typeof values;

  Object.keys(values)
    .forEach((key) => {
      if (typeof values[key as keyof Values] !== 'undefined') return;

      throw new Error(`${key} environment variable not set`);
    });

  return values as { [Key in keyof Values]: Exclude<Values[Key], undefined> };
})();
