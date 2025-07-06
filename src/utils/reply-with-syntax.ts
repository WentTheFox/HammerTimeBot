import { MessageTimestamp } from '../classes/message-timestamp.js';
import { formattedResponse, supportedFormats } from './time.js';
import {
  ChatInputCommandInteraction,
  ComponentType,
  ContextMenuCommandInteraction,
  InteractionReplyOptions,
  MessageFlags,
  SeparatorSpacingSize,
} from 'discord.js';
import { GlobalCommandOptionName, ResponseColumnChoices } from '../types/localization.js';
import { EPHEMERAL_OPTION_DEFAULT_VALUE, isEphemeralResponse } from './messaging.js';
import { getExactTimePrefix } from './get-exact-time-prefix.js';
import { SettingsValue } from './settings.js';
import { Moment } from 'moment';
import { formatSelectComponent } from '../components/format-select.component.js';
import { EmojiCharacters } from '../constants/emoji-characters.js';
import { InteractionContext } from '../types/bot-interaction.js';
import { addIncompleteTranslationsFooter } from './interaction-reply.js';
import { getTelemetryPlaceholder } from './add-telemetry-note-to-reply.js';

type HandledInteractions = ChatInputCommandInteraction | ContextMenuCommandInteraction;

export const mapCommandInteractionToSyntaxInteraction = (
  interaction: HandledInteractions,
  settings: Pick<SettingsValue, 'ephemeral' | 'columns' | 'format' | 'header'> | undefined,
): SyntaxInteraction => {
  if (interaction.isContextMenuCommand()) {
    return {
      columns: null,
      format: null,
      header: null,
      ephemeral: true,
    };
  }

  return ({
    columns: interaction.options.getString(GlobalCommandOptionName.COLUMNS) ?? settings?.columns ?? ResponseColumnChoices.BOTH,
    format: interaction.options.getString(GlobalCommandOptionName.FORMAT) ?? settings?.format ?? null,
    header: interaction.options.getBoolean(GlobalCommandOptionName.HEADER) ?? settings?.header ?? true,
    ephemeral: isEphemeralResponse(interaction, settings),
  });
};

export interface SyntaxInteraction {
  columns: string | null;
  format: string | null;
  header: boolean | null;
  ephemeral: boolean | null;
}

interface SyntaxReplyOptions {
  localMoment: Moment;
  interaction: HandledInteractions;
  context: InteractionContext;
  timezone?: string;
  settings: Pick<
  SettingsValue,
  'ephemeral' | 'columns' | 'format' | 'header' | 'boldPreview' | 'formatMinimalReply' | 'telemetry'
  > | undefined;
  usingAtHoursOnly?: boolean;
}

export const getSyntaxReplyOptions = async ({
  localMoment,
  interaction,
  context,
  timezone = 'UTC',
  settings,
  usingAtHoursOnly = false,
}: SyntaxReplyOptions): Promise<InteractionReplyOptions> => {
  const { t, emojiIdMap } = context;
  const localDate = localMoment.toDate();
  if (!localMoment.isValid()) {
    return {
      content: t('commands.global.responses.invalidDate'),
      flags: MessageFlags.Ephemeral,
    };
  }

  const syntaxInteraction = mapCommandInteractionToSyntaxInteraction(interaction, settings);

  const ts = new MessageTimestamp(localDate);
  const formatInput = MessageTimestamp.isValidFormat(syntaxInteraction.format) ? syntaxInteraction.format : null;
  const formats = formatInput ? [formatInput] : supportedFormats;
  const singleFormatReply = formatInput && settings?.formatMinimalReply;

  const columns = singleFormatReply ? ResponseColumnChoices.PREVIEW_ONLY : (syntaxInteraction.columns ?? ResponseColumnChoices.BOTH);
  const addHeader = !(singleFormatReply) && (syntaxInteraction.header ?? true);
  const header = addHeader && getExactTimePrefix(localMoment, timezone);
  const table = formattedResponse(ts, formats, columns as ResponseColumnChoices, !formatInput && (settings?.boldPreview ?? null));
  const content: string | undefined = `${header ? `${header}\n` : ''}${table}`;
  const shouldReplyBeEphemeral = syntaxInteraction.ephemeral ?? EPHEMERAL_OPTION_DEFAULT_VALUE;

  if (singleFormatReply) {
    return {
      flags: shouldReplyBeEphemeral ? MessageFlags.Ephemeral : undefined,
      content,
    };
  }

  const telemetryPlaceholder: InteractionReplyOptions['components'] =
    settings?.telemetry ? getTelemetryPlaceholder(context) ?? [] : [];
  let replyOptions: InteractionReplyOptions = {
    flags: MessageFlags.IsComponentsV2 | (shouldReplyBeEphemeral ? MessageFlags.Ephemeral : 0),
    components: [
      {
        type: ComponentType.TextDisplay,
        content,
      },
    ],
  };
  if (!formatInput) {
    // TODO Looks like this hangs all shards other than 0, get this from Bot API instead
    const at12CommandMention = typeof context.commandIdMap.at12 !== 'undefined'
      ? `</at12:${context.commandIdMap.at12}>`
      : `\`/${t('commands.at12.name')}\``;
    replyOptions = addIncompleteTranslationsFooter(t, interaction, {
      ...replyOptions,
      components: [
        {
          type: ComponentType.TextDisplay,
          content,
        },
        ...(usingAtHoursOnly ? [
          {
            type: ComponentType.Separator,
            divider: true,
            spacing: SeparatorSpacingSize.Small,
          },
          {
            type: ComponentType.TextDisplay,
            content: `-# ${EmojiCharacters.INFO} ${t('commands.global.components.at12Hint', {
              slashAt: `</${interaction.commandName}:${interaction.commandId}>`,
              slashAt12: at12CommandMention,
              hourOptionName: `\`${t('commands.at.options.hour.name')}\``,
              hour12OptionName: `\`${t('commands.at.options.hour12.name')}\``,
              amOptionName: `\`${t('commands.at.options.am.name')}\``,
              pmOptionName: `\`${t('commands.at.options.pm.name')}\``,
            })}`,
          },
        ] : []),
        {
          type: ComponentType.Separator,
          divider: true,
          spacing: SeparatorSpacingSize.Small,
        },
        {
          type: ComponentType.TextDisplay,
          content: t('commands.global.components.replyWithSpecificFormat'),
        },
        {
          type: ComponentType.ActionRow,
          components: [
            formatSelectComponent.getDefinition(t, emojiIdMap),
          ],
        },
        ...telemetryPlaceholder,
      ],
    });
  }
  return replyOptions;
};

interface ReplyWithSyntaxParams {
  localMoment: Moment;
  interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction;
  context: InteractionContext;
  timezone: string | undefined;
  usingAtHoursOnly?: boolean;
  settings: Pick<SettingsValue, 'ephemeral' | 'columns' | 'format' | 'header' | 'boldPreview' | 'formatMinimalReply' | 'telemetry'> | undefined;
}

export const replyWithSyntax = async ({
  localMoment,
  interaction,
  context,
  timezone = 'UTC',
  settings,
  usingAtHoursOnly,
}: ReplyWithSyntaxParams): Promise<unknown> => {
  return interaction.reply(await getSyntaxReplyOptions({
    localMoment,
    interaction,
    context,
    timezone,
    settings,
    usingAtHoursOnly,
  }));
};
