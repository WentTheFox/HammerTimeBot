import { ButtonStyle, ComponentType } from 'discord.js';
import { BotMessageComponent, BotMessageComponentType } from '../types/bot-interaction.js';
import { proposalComponentHandler } from './component-handlers/proposal.component-handler.js';

export const rejectProposalComponent: BotMessageComponent = {
  getDefinition: (t, customEmojiIds, idSuffix) => ({
    type: ComponentType.Button,
    custom_id: `${BotMessageComponentType.REJECT_PROPOSAL}:${idSuffix}`,
    style: ButtonStyle.Danger,
    label: 'Reject',
  }),
  handle: proposalComponentHandler('reject'),
};
