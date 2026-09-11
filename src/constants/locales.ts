import { join } from 'path';
import { createI18nInitializer } from '@went.tf/discord-bot-framework/i18n';
import { env } from '../env.js';
import { Locale } from 'discord-api-types/v10';

// Type-safe language constants
export const SUPPORTED_LANGUAGES = Object.values(Locale) as Locale[];
export const DEFAULT_LANGUAGE = Locale.EnglishUS;
export const CROWDIN_PROJECT_URL = `https://crowdin.com/project/${env.CROWDIN_PROJECT_IDENTIFIER}`;

export const initI18next = createI18nInitializer({
  localesDir: join('.', 'src', 'locales'),
  supportedLngs: SUPPORTED_LANGUAGES,
  fallbackLng: DEFAULT_LANGUAGE,
  debug: env.DEBUG_I18N,
});
