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
import { TFunction } from 'i18next';
import { env } from '../env.js';
import { LANGUAGES } from '../constants/language-config.js';
import { filledBar } from 'string-progressbar';
import { EmojiCharacters } from '../constants/emoji-characters.js';

import { CROWDIN_PROJECT_URL } from '../constants/locales.js';
import { UserInteractionContext } from '../types/bot-interaction.js';

type InteractionReplyOptionsWithComponents = InteractionReplyOptions & { components: Required<InteractionReplyOptions>['components'] };

const isInteractionReplyOptionsWithComponents = (options: InteractionReplyOptions): options is InteractionReplyOptionsWithComponents => Boolean(options.components);

const upgradeToComponentsV2 = (options: InteractionReplyOptions, commandIdMap: Record<string, string|undefined>): InteractionReplyOptionsWithComponents => {
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
        content: reformatCommandNamesInContent(content, commandIdMap),
      },
    ],
  };
};

export const reformatCommandNamesInContent = (content: string | undefined, commandIdMap: Record<string, string|undefined>) =>
  content?.replace(/`\/(\S+)`/g, (fullMatchText, commandName) => {
    return commandName in commandIdMap ? `</${commandName}:${commandIdMap[commandName]}>` : fullMatchText;
  });

export const addIncompleteTranslationsFooter = (t: TFunction, interaction: CommandInteraction | ChatInputCommandInteraction | ContextMenuCommandInteraction | MessageComponentInteraction, options: InteractionReplyOptionsWithComponents): InteractionReplyOptionsWithComponents => {
  const translationCompletionData = getTranslationCompletionData(interaction.locale);
  if (typeof translationCompletionData?.approval === 'number' && translationCompletionData.approval < 100 && env.CROWDIN_PROJECT_IDENTIFIER) {
    const crowdinLocale = LANGUAGES[interaction.locale].crowdinLocale ?? interaction.locale;
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

export const interactionReply = ({ t, commandIdMap }: Pick<UserInteractionContext, 't' | 'commandIdMap'>, interaction: CommandInteraction | ChatInputCommandInteraction | ContextMenuCommandInteraction | MessageComponentInteraction, options: InteractionReplyOptions) => {
  const upgradedOptions = upgradeToComponentsV2(options, commandIdMap);
  const optionsWithFooter = addIncompleteTranslationsFooter(t, interaction, upgradedOptions);
  return interaction.reply(optionsWithFooter);
};
