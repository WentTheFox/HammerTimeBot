import { join } from 'path';
import i18next, { i18n } from 'i18next';
import Backend from 'i18next-fs-backend';
import { env } from '../env.js';
import { Locale } from 'discord-api-types/v10';
import { NestableLogger } from '../types/logger-types.js';

// Type-safe language constants
export const SUPPORTED_LANGUAGES = Object.values(Locale) as Locale[];
export const DEFAULT_LANGUAGE = Locale.EnglishUS;
export const CROWDIN_PROJECT_URL = `https://crowdin.com/project/${env.CROWDIN_PROJECT_IDENTIFIER}`;

const localesPath = join('.', 'src', 'locales');
let i18nextInitPromise: Promise<typeof i18next> | null = null;

export const initI18next = async (logger: NestableLogger): Promise<i18n> => {
  if (i18nextInitPromise !== null) {
    return i18nextInitPromise;
  }

  logger.log('Initializing i18n');

  i18nextInitPromise = i18next.use(Backend).init({
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    debug: env.DEBUG_I18N,
    preload: SUPPORTED_LANGUAGES,
    backend: {
      loadPath: join(localesPath, '{{lng}}', '{{ns}}.json'),
    },
    interpolation: {
      escapeValue: false,
    },
    overloadTranslationOptionHandler: () => ({}),
    showSupportNotice: false,
  }).then(() => i18next);

  return await i18nextInitPromise;
};
