import {
  ButtonStyle,
  ChatInputCommandInteraction,
  CommandInteraction,
  ComponentType,
  ContextMenuCommandInteraction,
  InteractionReplyOptions,
  MessageComponentInteraction,
  MessageFlags,
  SeparatorSpacingSize,
} from 'discord.js';
import { getTranslationCompletionData } from '../../utils/helpers/crowdin-types.js';
import { env } from '../env.js';
import { LANGUAGES } from '../constants/language-config.js';
import { TFunction } from 'i18next';
import { filledBar } from 'string-progressbar';
import { EmojiCharacters } from '../constants/emoji-characters.js';

import { CROWDIN_PROJECT_URL } from '../constants/locales.js';
import { InteractionContext, UserInteractionContext } from '../types/bot-interaction.js';

type InteractionReplyOptionsWithComponents = InteractionReplyOptions & {
  components: Required<InteractionReplyOptions>['components']
};

const isInteractionReplyOptionsWithComponents = (options: InteractionReplyOptions): options is InteractionReplyOptionsWithComponents => Boolean(options.components);

const upgradeToComponentsV2 = (options: InteractionReplyOptions, context: Pick<InteractionContext, 't' | 'commandIdMap'>): InteractionReplyOptionsWithComponents => {
  if (isInteractionReplyOptionsWithComponents(options)) {
    return options;
  }

  const { content, flags, ...rest } = options;
  return {
    ...rest,
    flags: (typeof flags === 'number' ? flags : 0) | MessageFlags.IsComponentsV2,
    components: [
      {
        type: ComponentType.TextDisplay,
        content: reformatCommandNamesInContent(content, context),
      },
    ],
  };
};

export const reformatCommandNamesInContent = <T extends string|undefined>(content: T, context: Pick<InteractionContext, 't' | 'commandIdMap'>): T extends string ? string : undefined =>
  content?.replace(/`\/(\S+)`/g, (_, commandName) => createCommandMention(commandName, context)) as never;

export const createCommandMention = (commandName: string, {
  t,
  commandIdMap
}: Pick<InteractionContext, 't' | 'commandIdMap'>) => {
  if (typeof commandIdMap[commandName] !== 'undefined') {
    return `</${commandName}:${commandIdMap[commandName]}>`;
  }
  const tKey = `commands.${commandName}.name`;
  const translatedCommandName = t(tKey);
  return `\`/${translatedCommandName === tKey ? commandName : translatedCommandName}\``;
};

/** Primary language that a function created by `i18next.getFixedT()` translates into */
const getTFunctionLanguage = (t: TFunction, fallback: string): string => {
  const { lng, lngs } = t as TFunction & { lng?: string, lngs?: string[] };
  return lng ?? lngs?.[0] ?? fallback;
};

export const addIncompleteTranslationsFooter = ({ t }: Pick<InteractionContext, 't'>, interaction: CommandInteraction | ChatInputCommandInteraction | ContextMenuCommandInteraction | MessageComponentInteraction, options: InteractionReplyOptionsWithComponents): InteractionReplyOptionsWithComponents => {
  // The message may not be in the user's locale (e.g. public replies use the server's locale), so report on the language actually used
  const language = getTFunctionLanguage(t, interaction.locale) as keyof typeof LANGUAGES;
  const translationCompletionData = getTranslationCompletionData(language);
  if (typeof translationCompletionData?.approval === 'number' && translationCompletionData.approval < 100 && env.CROWDIN_PROJECT_IDENTIFIER) {
    const crowdinLocale = LANGUAGES[language]?.crowdinLocale ?? language;
    options.components = [
      ...options.components,
      {
        type: ComponentType.Separator,
        divider: true,
        spacing: SeparatorSpacingSize.Large,
      },
      {
        type: ComponentType.Section,

        components: [
          {
            type: ComponentType.TextDisplay,
            content: [
              `**${t('commands.global.components.incompleteTranslations')}**`,
              filledBar(100, translationCompletionData.approval, 18, EmojiCharacters.WHITE_SQUARE, EmojiCharacters.GREEN_SQUARE)[0],
            ].map(line => `-# ${line}`).join('\n'),
          },
        ],
        accessory: {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          url: `${CROWDIN_PROJECT_URL}/${crowdinLocale}`,
          label: t('commands.global.components.contributeTranslations'),
          emoji: { name: EmojiCharacters.HELP_RING },
        },
      },
    ];
  }
  return options;
};

export const interactionReply = (context: Pick<UserInteractionContext, 't' | 'commandIdMap'>, interaction: CommandInteraction | ChatInputCommandInteraction | ContextMenuCommandInteraction | MessageComponentInteraction, options: InteractionReplyOptions) => {
  const upgradedOptions = upgradeToComponentsV2(options, context);
  const optionsWithFooter = addIncompleteTranslationsFooter(context, interaction, upgradedOptions);
  return interaction.reply(optionsWithFooter);
};
