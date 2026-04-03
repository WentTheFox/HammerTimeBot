import { ButtonStyle, ComponentType } from 'discord.js';
import { BotMessageComponent, BotMessageComponentType } from '../types/bot-interaction.js';
import { proposalComponentHandler } from './component-handlers/proposal.component-handler.js';

export const approveProposalComponent: BotMessageComponent = {
  getDefinition: (t, customEmojiIds, idSuffix) => ({
    type: ComponentType.Button,
    custom_id: `${BotMessageComponentType.APPROVE_PROPOSAL}:${idSuffix}`,
    style: ButtonStyle.Success,
    label: 'Approve',
  }),
  handle: proposalComponentHandler('approve'),
};
