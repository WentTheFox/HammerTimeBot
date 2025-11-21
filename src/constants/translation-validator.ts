import { Localization } from '../types/localization.js';
import { Locale } from 'discord-api-types/v10';
import type enUS from '../locales/en-US/translation.json';
import type enGB from '../locales/en-GB/translation.json';
import type bg from '../locales/bg/translation.json';
import type zhCN from '../locales/zh-CN/translation.json';
import type zhTW from '../locales/zh-TW/translation.json';
import type hr from '../locales/hr/translation.json';
import type cs from '../locales/cs/translation.json';
import type da from '../locales/da/translation.json';
import type nl from '../locales/nl/translation.json';
import type fi from '../locales/fi/translation.json';
import type fr from '../locales/fr/translation.json';
import type de from '../locales/de/translation.json';
import type el from '../locales/el/translation.json';
import type hi from '../locales/hi/translation.json';
import type hu from '../locales/hu/translation.json';
import type it from '../locales/it/translation.json';
import type id from '../locales/id/translation.json';
import type ja from '../locales/ja/translation.json';
import type ko from '../locales/ko/translation.json';
import type lt from '../locales/lt/translation.json';
import type no from '../locales/no/translation.json';
import type pl from '../locales/pl/translation.json';
import type ptBR from '../locales/pt-BR/translation.json';
import type ro from '../locales/ro/translation.json';
import type ru from '../locales/ru/translation.json';
import type esES from '../locales/es-ES/translation.json';
import type es419 from '../locales/es-419/translation.json';
import type svSE from '../locales/sv-SE/translation.json';
import type th from '../locales/th/translation.json';
import type tr from '../locales/tr/translation.json';
import type uk from '../locales/uk/translation.json';
import type vi from '../locales/vi/translation.json';


type TypeValidator<T extends Record<Locale, Localization>> = T;
/* eslint-disable @typescript-eslint/no-unused-vars -- This type validates the structure of the i18n files at build time */
// noinspection JSUnusedLocalSymbols
type ValidatedLocalizationMap = TypeValidator<{
  [Locale.EnglishUS]: typeof enUS,
  [Locale.EnglishGB]: typeof enGB,
  [Locale.Bulgarian]: typeof bg,
  [Locale.ChineseCN]: typeof zhCN,
  [Locale.ChineseTW]: typeof zhTW,
  [Locale.Croatian]: typeof hr,
  [Locale.Czech]: typeof cs,
  [Locale.Danish]: typeof da,
  [Locale.Dutch]: typeof nl,
  [Locale.Finnish]: typeof fi,
  [Locale.French]: typeof fr,
  [Locale.German]: typeof de,
  [Locale.Greek]: typeof el,
  [Locale.Hindi]: typeof hi,
  [Locale.Hungarian]: typeof hu,
  [Locale.Indonesian]: typeof id,
  [Locale.Italian]: typeof it,
  [Locale.Japanese]: typeof ja,
  [Locale.Korean]: typeof ko,
  [Locale.Lithuanian]: typeof lt,
  [Locale.Norwegian]: typeof no,
  [Locale.Polish]: typeof pl,
  [Locale.PortugueseBR]: typeof ptBR,
  [Locale.Romanian]: typeof ro,
  [Locale.Russian]: typeof ru,
  [Locale.SpanishES]: typeof esES,
  [Locale.SpanishLATAM]: typeof es419,
  [Locale.Swedish]: typeof svSE,
  [Locale.Thai]: typeof th,
  [Locale.Turkish]: typeof tr,
  [Locale.Ukrainian]: typeof uk,
  [Locale.Vietnamese]: typeof vi,
}>;
/* eslint-enable @typescript-eslint/no-unused-vars */
