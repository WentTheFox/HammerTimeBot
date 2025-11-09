import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from '../constants/locales.js';
import { LocaleString } from 'discord-api-types/v10';

type LocalizedKey = 'description' | 'name';
type LocalizationsKey<Key extends LocalizedKey> = `${Key}_localizations`;
export type SupportedLocalizations = Record<LocaleString, string>;
export type SupportedLocalizationMap<Key extends LocalizedKey> = Record<LocalizationsKey<Key>, SupportedLocalizations>;
export type LocalizedValue<Key extends LocalizedKey> =
  Record<Key, string>
  & SupportedLocalizationMap<Key>;

export type TranslatorFunction = (lng?: LocaleString) => string;

export function getLocalizedObject<Key extends LocalizedKey>(key: Key, translator: TranslatorFunction, includeBaseKey: false, sanitize?: boolean): SupportedLocalizationMap<Key>;
export function getLocalizedObject<Key extends LocalizedKey>(key: Key, translator: TranslatorFunction, includeBaseKey?: true, sanitize?: boolean): LocalizedValue<Key>;

export function getLocalizedObject<Key extends LocalizedKey>(key: Key, translator: TranslatorFunction, includeBaseKey = true, sanitize = true): LocalizedValue<Key> {
  const localizationsKey: LocalizationsKey<Key> = `${key}_localizations` as const;
  const defaultValue = translator(DEFAULT_LANGUAGE);
  const baseObject = includeBaseKey ? { [key]: defaultValue } : undefined;

  return {
    ...baseObject,
    [localizationsKey]: SUPPORTED_LANGUAGES.reduce((localizations, locale) => {
      let value = translator(locale);

      if (sanitize && key === 'name') {
        // Automatically replace unsupported characters with dash and make all-lowercase
        value = value.toLowerCase().replace(/[\s（）.]/g, '-').replace(/-+$/, '');
      }
      return ({
        ...localizations,
        [locale]: value,
      });
    }, {} as SupportedLocalizations),
  } as LocalizedValue<Key>;
}
