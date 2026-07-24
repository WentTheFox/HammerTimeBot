import {
  createChatInputCommandRegistry,
  createComponentRegistry,
  createContextMenuCommandRegistry,
} from '@went.tf/discord-bot-framework/interactions';
import { addCommand } from '../../commands/add.command.js';
import { agoCommand } from '../../commands/ago.command.js';
import { at12Command } from '../../commands/at12.command.js';
import { atCommand } from '../../commands/at.command.js';
import { apiCommand } from '../../commands/api.command.js';
import { extractTimestampsCommand } from '../../commands/extract-timestamps.command.js';
import { faqCommand } from '../../commands/faq.command.js';
import { inCommand } from '../../commands/in.command.js';
import { isoCommand } from '../../commands/iso.command.js';
import { messageLastEditedCommand } from '../../commands/message-last-edited.command.js';
import { messageSentCommand } from '../../commands/message-sent.command.js';
import { settingsCommand } from '../../commands/settings.command.js';
import { snowflakeCommand } from '../../commands/snowflake.command.js';
import { statisticsCommand } from '../../commands/statistics.command.js';
import { subtractCommand } from '../../commands/subtract.command.js';
import { unixCommand } from '../../commands/unix.command.js';
import { approveProposalComponent } from '../../components/approve-proposal.component.js';
import { formatSelectComponent } from '../../components/format-select.component.js';
import { rejectProposalComponent } from '../../components/reject-proposal.component.js';

export const chatInputCommandRegistry = createChatInputCommandRegistry([
  addCommand,
  agoCommand,
  atCommand,
  inCommand,
  statisticsCommand,
  subtractCommand,
  unixCommand,
  snowflakeCommand,
  isoCommand,
  settingsCommand,
  apiCommand,
  at12Command,
  faqCommand,
]);

export const contextMenuCommandRegistry = createContextMenuCommandRegistry([
  messageSentCommand,
  messageLastEditedCommand,
  extractTimestampsCommand,
]);

export const componentRegistry = createComponentRegistry([
  formatSelectComponent,
  approveProposalComponent,
  rejectProposalComponent,
]);
