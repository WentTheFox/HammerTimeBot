import { MessageComponentInteraction } from 'discord.js';
import { approveProposalComponent } from '../../components/approve-proposal.component.js';
import { rejectProposalComponent } from '../../components/reject-proposal.component.js';
import { formatSelectComponent } from '../../components/format-select.component.js';
import { BotMessageComponent, BotMessageComponentType } from '../../types/bot-interaction.js';
import { getCustomIdSegments } from '../messaging.js';

export const messageComponentMap: Record<BotMessageComponentType, BotMessageComponent> = {
  [BotMessageComponentType.FORMAT_SELECT]: formatSelectComponent,
  [BotMessageComponentType.APPROVE_PROPOSAL]: approveProposalComponent,
  [BotMessageComponentType.REJECT_PROPOSAL]: rejectProposalComponent,
};

export const messageComponents = (Object.keys(messageComponentMap) as BotMessageComponentType[]);

export const isKnownMessageComponent = (customId: string): customId is BotMessageComponentType => customId in messageComponentMap;

export type BotMessageComponentCustomId =
  BotMessageComponentType
  | `${BotMessageComponentType}:${string}`;

export const isKnownMessageComponentInteraction = <InteractionType extends MessageComponentInteraction>(interaction: InteractionType): interaction is InteractionType & {
  customId: BotMessageComponentCustomId
} => {
  const { customId } = getCustomIdSegments(interaction.customId);
  return isKnownMessageComponent(customId);
};
