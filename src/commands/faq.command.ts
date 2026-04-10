import { ApplicationCommandType, MessageFlags } from 'discord-api-types/v10';
import { FAQ_ENTRIES, FaqEntryKey } from '../faq/faq-entries.generated.js';
import { getFaqOptions } from '../options/faq.options.js';
import { BotChatInputCommand } from '../types/bot-interaction.js';
import { FaqCommandOptionName, GlobalCommandOptionName } from '../types/localization.js';
import { getLocalizedObject } from '../utils/get-localized-object.js';
import { truncateText } from '../utils/messaging.js';

const formatFaqIdentifier = (identifier: number) => String(identifier)
  .replace(/0*([1-9]|[1-9]\d)$/, '.$1')
  .replace(/0{2}$/, '');

export const faqCommand: BotChatInputCommand = {
  getDefinition: (t) => ({
    type: ApplicationCommandType.ChatInput,
    ...getLocalizedObject('description', (lng) => t('commands.faq.description', { lng })),
    ...getLocalizedObject('name', (lng) => t('commands.faq.name', { lng })),
    options: getFaqOptions(t),
  }),
  async autocomplete(interaction) {
    const query = interaction.options.getFocused().trim().toLowerCase();
    const results = Object.values(FAQ_ENTRIES).filter((entry) =>
      entry.id.toString().startsWith(query) || entry.title.toLowerCase().includes(query),
    );
    await interaction.respond(
      results.slice(0, 25).map((entry) => {
        const label = `${formatFaqIdentifier(entry.id)}) ${entry.title}`;
        return {
          name: truncateText(label, 100),
          value: entry.id.toString(),
        };
      }),
    );
  },
  async handle(interaction) {
    const topic = parseInt(interaction.options.getString(FaqCommandOptionName.TOPIC, true), 10) as FaqEntryKey;
    const ephemeral = interaction.options.getBoolean(GlobalCommandOptionName.EPHEMERAL) ?? true;
    const entry = !isNaN(topic) ? FAQ_ENTRIES[topic] : undefined;

    if (!entry) {
      await interaction.reply({
        content: `Could not find FAQ entry with identifier "${topic}"`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: `# ${formatFaqIdentifier(entry.id)}) ${entry.title}\n${entry.content}`,
      flags: ephemeral ? MessageFlags.Ephemeral : undefined,
    });
  },
};
