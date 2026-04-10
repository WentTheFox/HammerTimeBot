import { APIApplicationCommandOption, ApplicationCommandOptionType } from 'discord-api-types/v10';
import { TFunction } from 'i18next';
import { FaqCommandOptionName } from '../types/localization.js';
import { getLocalizedObject } from '../utils/get-localized-object.js';
import { getEphemeralOption } from './global.options.js';

export const getFaqOptions = (t: TFunction): APIApplicationCommandOption[] => [
  {
    name: FaqCommandOptionName.TOPIC,
    ...getLocalizedObject('name', (lng) => t('commands.faq.options.topic.name', { lng }), false),
    ...getLocalizedObject('description', (lng) => t('commands.faq.options.topic.description', { lng })),
    type: ApplicationCommandOptionType.String,
    required: true,
    autocomplete: true,
  },
  getEphemeralOption(t),
];
