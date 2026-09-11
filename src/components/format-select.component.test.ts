import { describe, expect, it, vi } from 'vitest';
import { ComponentType } from 'discord.js';
import { MessageFlags } from 'discord-api-types/v10';
import { MessageTimestampFormat } from '../classes/message-timestamp.js';

vi.mock('../utils/messaging.js', () => ({
  findTextComponentContentsRecursively: () => [],
}));

const { formatSelectComponent } = await import('./format-select.component.js');

const createInteraction = (overrides: Partial<{ replied: boolean }> = {}) => ({
  componentType: ComponentType.StringSelect,
  values: [MessageTimestampFormat.SHORT_DATE],
  message: {
    content: 'Preview: <t:1700000000:F>',
    components: [],
  },
  replied: false,
  ...overrides,
  reply: vi.fn().mockResolvedValue(undefined),
  editReply: vi.fn().mockResolvedValue(undefined),
});

describe('formatSelectComponent.handle', () => {
  it('replies with the formatted timestamp when the interaction has not been replied to', async () => {
    const interaction = createInteraction({ replied: false });

    await formatSelectComponent.handle(interaction as never, {} as never, undefined);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: `<t:1700000000:${MessageTimestampFormat.SHORT_DATE}>`,
      flags: MessageFlags.Ephemeral,
    });
    expect(interaction.editReply).not.toHaveBeenCalled();
  });

  it('edits the existing reply instead of replying again when the interaction was already replied to', async () => {
    const interaction = createInteraction({ replied: true });

    await formatSelectComponent.handle(interaction as never, {} as never, undefined);

    expect(interaction.editReply).toHaveBeenCalledWith({
      content: `<t:1700000000:${MessageTimestampFormat.SHORT_DATE}>`,
    });
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('throws when the interaction is not a string select interaction', async () => {
    const interaction = { ...createInteraction(), componentType: ComponentType.Button };

    await expect(formatSelectComponent.handle(interaction as never, {} as never, undefined))
      .rejects.toThrow('String select interaction expected');
  });

  it('throws when no timestamp can be found in the original message', async () => {
    const interaction = createInteraction();
    interaction.message.content = 'No timestamp here';

    await expect(formatSelectComponent.handle(interaction as never, {} as never, undefined))
      .rejects.toThrow(/No timestamp could be found/);
  });
});
