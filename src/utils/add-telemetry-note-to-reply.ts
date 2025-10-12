import {
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
  InteractionReplyOptions,
  SeparatorSpacingSize,
} from 'discord.js';
import { InteractionContext } from '../types/bot-interaction.js';
import { APISeparatorComponent, ComponentType } from 'discord-api-types/v10';
import { env } from '../env.js';
import { EmojiCharacters } from '../constants/emoji-characters.js';
import { emoji, getBareNumberFormatter } from './messaging.js';

const telemetryPlaceholderSeparator: APISeparatorComponent = {
  type: ComponentType.Separator,
  divider: true,
  spacing: SeparatorSpacingSize.Large,
};

export interface TelemetryResponse {
  executionNumber: number | undefined;
  privacyPolicyUrl: string | undefined;
  commandName: string | undefined;
  commandId: string | undefined;
}

export const addTelemetryNoteToReply = async (
  context: InteractionContext,
  interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction,
  telemetryResponse: TelemetryResponse | undefined | null,
) => {
  const logger = context.logger.nest('addTelemetryNoteToReply');
  if (telemetryResponse === null) {
    logger.debug('Skipped');
    return;
  }

  logger.debug('Adding telemetry note to reply…');
  let reply;
  try {
    reply = await interaction.fetchReply();
  } catch (e) {
    logger.error('Could not get interaction reply', e);
  }
  if (!reply) {
    logger.info('No reply has been sent for this interaction, not adding telemetry note');
    return;
  }

  if (!reply.flags.has('IsComponentsV2')) {
    logger.info('Reply is not Components V2, not adding telemetry note');
    return;
  }

  const placeholderComponentIndex = reply.components.findIndex(component => (
    component.type === ComponentType.TextDisplay && component.content.includes(EmojiCharacters.BAR_CHART)
  ));
  let replyComponentsWithoutPlaceholder: InteractionReplyOptions['components'] = reply.components.filter(
    (_, i) =>  i !== placeholderComponentIndex,
  );
  if (placeholderComponentIndex === -1) {
    replyComponentsWithoutPlaceholder = [...replyComponentsWithoutPlaceholder, telemetryPlaceholderSeparator];
  }

  const numberFormatter = getBareNumberFormatter(interaction, context);
  const privacyPolicyUrl = telemetryResponse?.privacyPolicyUrl ?? `${env.API_URL}/legal#privacy-policy`;
  await interaction.editReply({
    components: [
      ...replyComponentsWithoutPlaceholder,
      {
        type: ComponentType.TextDisplay,
        content: [
          '-#',
          telemetryResponse ? context.t('commands.global.components.telemetryInfoCount', {
            executionNumber: numberFormatter.format(telemetryResponse.executionNumber ?? -1),
            command: `</${telemetryResponse.commandName}:${telemetryResponse.commandId}>`,
          }) : null,
          context.t('commands.global.components.telemetryThankYou', {
            privacyPolicy: `[${context.t('commands.global.components.privacyPolicyLink')}](<${privacyPolicyUrl}>)`,
          }),
        ].filter(Boolean).join(' '),
      },
    ],
  });
  logger.debug('Successfully added telemetry note to reply');
};

export const getTelemetryPlaceholder = (context: InteractionContext): InteractionReplyOptions['components'] => [
  telemetryPlaceholderSeparator,
  {
    type: ComponentType.TextDisplay,
    content: [
      `**${emoji(context, 'loading', true)} ${context.t('commands.global.components.recordingTelemetry')}**`,
      `_${EmojiCharacters.BAR_CHART} ${context.t('commands.global.components.telemetryPlaceholder')}_`,
    ].map(line => `-# ${line}`).join('\n'),
  },
];
