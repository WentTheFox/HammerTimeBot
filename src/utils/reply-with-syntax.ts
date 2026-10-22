import { isCommandError, renderTimestamp } from '@went.tf/hammertime-core';
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
import { SettingsValue } from './settings.js';
import { formatSelectComponent } from '../components/format-select.component.js';
import { EmojiCharacters } from '../constants/emoji-characters.js';
import { InteractionContext } from '../types/bot-interaction.js';
import { addIncompleteTranslationsFooter, createCommandMention } from './interaction-reply.js';
import {
  buildTelemetryNote,
  getTelemetryPlaceholder,
  telemetryPlaceholderSeparator,
  TelemetryResponse,
} from './add-telemetry-note-to-reply.js';
import { TZDate } from '@date-fns/tz';

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
  localDate: TZDate;
  interaction: HandledInteractions;
  context: InteractionContext;
  timezone?: string;
  settings: Pick<
  SettingsValue,
  'ephemeral' | 'columns' | 'format' | 'header' | 'boldPreview' | 'formatMinimalReply' | 'telemetry'
  > | undefined;
  usingAtHoursOnly?: boolean;
}

/** How the reply deals with the telemetry note */
export type TelemetryPresentation =
  /** The run is recorded after the reply, a placeholder is replaced by the note once that is done */
  | { type: 'placeholder' }
  /** The run was recorded already (by the API), so the note is part of the reply. null when the account opted out. */
  | { type: 'recorded'; response: TelemetryResponse | undefined | null };

interface BuildSyntaxReplyOptions {
  rendered: { content: string; singleFormat: string | null; minimalReply: boolean };
  interaction: HandledInteractions;
  context: InteractionContext;
  settings: Pick<SettingsValue, 'ephemeral' | 'columns' | 'format' | 'header' | 'telemetry'> | undefined;
  usingAtHoursOnly?: boolean;
  telemetry: TelemetryPresentation;
}

/**
 * The Discord reply for a rendered timestamp: the reply itself is decided elsewhere (here or by the API), this
 * is the part that is about Discord, such as the format picker, the hints and the telemetry note
 */
export const buildSyntaxReplyOptions = ({
  rendered: { content, singleFormat: formatInput, minimalReply: singleFormatReply },
  interaction,
  context,
  settings,
  usingAtHoursOnly = false,
  telemetry,
}: BuildSyntaxReplyOptions): InteractionReplyOptions => {
  const { t, emojiIdMap } = context;
  const syntaxInteraction = mapCommandInteractionToSyntaxInteraction(interaction, settings);
  const shouldReplyBeEphemeral = syntaxInteraction.ephemeral ?? EPHEMERAL_OPTION_DEFAULT_VALUE;

  if (singleFormatReply) {
    return {
      flags: shouldReplyBeEphemeral ? MessageFlags.Ephemeral : undefined,
      content,
    };
  }

  const telemetryPlaceholder: InteractionReplyOptions['components'] =
    telemetry.type === 'placeholder' && settings?.telemetry ? getTelemetryPlaceholder(context) ?? [] : [];
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
    replyOptions = addIncompleteTranslationsFooter(context, interaction, {
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
              slashAt: createCommandMention('at', context),
              slashAt12: createCommandMention('at12', context),
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

  if (telemetry.type === 'recorded' && telemetry.response !== null) {
    // Last, which is where the note ends up when it is added to the reply afterwards
    replyOptions = {
      ...replyOptions,
      components: [
        ...(replyOptions.components ?? []),
        telemetryPlaceholderSeparator,
        buildTelemetryNote(context, interaction, telemetry.response),
      ],
    };
  }

  return replyOptions;
};

export const getSyntaxReplyOptions = async ({
  localDate,
  interaction,
  context,
  timezone = 'UTC',
  settings,
  usingAtHoursOnly = false,
}: SyntaxReplyOptions): Promise<InteractionReplyOptions> => {
  const { t } = context;
  const syntaxInteraction = mapCommandInteractionToSyntaxInteraction(interaction, settings);
  const rendered = renderTimestamp(localDate, timezone, {
    columns: syntaxInteraction.columns,
    format: syntaxInteraction.format,
    header: syntaxInteraction.header,
  }, settings);
  if (isCommandError(rendered)) {
    return {
      content: t(rendered.error),
      flags: MessageFlags.Ephemeral,
    };
  }

  return buildSyntaxReplyOptions({ rendered, interaction, context, settings, usingAtHoursOnly, telemetry: { type: 'placeholder' } });
};

interface ReplyWithSyntaxParams {
  localDate: TZDate;
  interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction;
  context: InteractionContext;
  timezone: string | undefined;
  usingAtHoursOnly?: boolean;
  settings: Pick<SettingsValue, 'ephemeral' | 'columns' | 'format' | 'header' | 'boldPreview' | 'formatMinimalReply' | 'telemetry'> | undefined;
}

export const replyWithSyntax = async ({
  localDate,
  interaction,
  context,
  timezone = 'UTC',
  settings,
  usingAtHoursOnly,
}: ReplyWithSyntaxParams): Promise<unknown> => {
  return interaction.reply(await getSyntaxReplyOptions({
    localDate,
    interaction,
    context,
    timezone,
    settings,
    usingAtHoursOnly,
  }));
};
