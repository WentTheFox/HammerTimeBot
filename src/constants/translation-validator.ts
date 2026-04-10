import type enUS from '../locales/en-US/translation.json';
import { Localization } from '../types/localization.js';


type TypeValidator<T extends Localization> = T;
/* eslint-disable @typescript-eslint/no-unused-vars -- This type validates the structure of the i18n files at build time */
// noinspection JSUnusedLocalSymbols
type ValidatedLocalization = TypeValidator<typeof enUS>;
/* eslint-enable @typescript-eslint/no-unused-vars */
