import { CrowdinLanguage } from './crowdin-api-types.js';
import { Locale } from 'discord-api-types/rest/common.js';
import { isAvailableLanguage } from '../../src/constants/language-config.js';

const languageMapping: Record<string, Locale> = {};
export const mapCrowdinLanguageToAvailableLanguage = (crowdinLanguage: CrowdinLanguage): Locale | null => {
  if (crowdinLanguage.id in languageMapping) {
    return languageMapping[crowdinLanguage.id];
  }
  if (!isAvailableLanguage(crowdinLanguage.id)) {
    console.warn(`Language ${crowdinLanguage.id} (${crowdinLanguage.name}) is missing from the available languages list`);
    return null;
  }

  return crowdinLanguage.id;
};
