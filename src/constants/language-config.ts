import { Locale } from 'discord-api-types/v10';
import localeConfig from '../locales/config.json' with { type: 'json' };
import { LatestLanguageConfigType } from '../types/language-config.js';

type LanguagesConfig = Record<Locale, LatestLanguageConfigType>;

export const LANGUAGES: LanguagesConfig = localeConfig.languages;

export const isAvailableLanguage = (value: unknown): value is Locale => typeof value === 'string' && value in LANGUAGES;
