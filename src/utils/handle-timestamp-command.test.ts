import { defaultSettings, SettingsValue } from '@went.tf/hammertime-core';
import { DevNullLogger } from '@went.tf/discord-bot-framework/logger';
import { ChatInputCommandInteraction, ComponentType, Locale, MessageFlags } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { initI18next } from '../constants/locales.js';
import { UserInteractionContext } from '../types/bot-interaction.js';
import { CommandsApiClient, CommandsApiResult } from './commands-api.js';
import { handleTimestampCommand } from './handle-timestamp-command.js';
import { createTFunction } from './interaction-handlers/create-t-function.js';

const t = createTFunction({ i18next: await initI18next(new DevNullLogger()), ephemeral: true, locale: Locale.EnglishUS, guild: null });

const makeContext = (): UserInteractionContext => ({
  t,
  logger: new DevNullLogger(),
  emojiIdMap: {},
  commandIdMap: {},
  isWebhookMode: true,
  getSettings: async () => defaultSettings as SettingsValue,
});

const makeInteraction = (data: { name: string; value: unknown }[] = []) => ({
  user: { id: '175928847299117063' },
  locale: Locale.EnglishUS,
  commandName: 'at',
  options: { data, getString: () => null, getBoolean: () => null },
  isContextMenuCommand: () => false,
  reply: vi.fn(async () => undefined),
}) as unknown as ChatInputCommandInteraction & { reply: ReturnType<typeof vi.fn> };

const timestamp = (overrides: Record<string, unknown> = {}): CommandsApiResult => ({
  type: 'timestamp',
  body: {
    command: 'at',
    unix: 1650802953,
    timezone: 'GMT',
    header: '📅 2022-04-24',
    content: '📅 2022-04-24\n`<t:1650802953:f>` → <t:1650802953:f>',
    singleFormat: null,
    minimalReply: false,
    telemetry: { executionNumber: 7, command: 'at', privacyPolicyUrl: 'https://example.test/legal' },
    ...overrides,
  },
});

const apiAnswering = (result: CommandsApiResult | null) => ({ run: vi.fn(async () => result) } satisfies CommandsApiClient);

const run = async ({ result, settings = defaultSettings as SettingsValue, api = apiAnswering(result ?? null), interaction = makeInteraction(), context = makeContext() }: {
  result?: CommandsApiResult | null;
  settings?: SettingsValue;
  api?: CommandsApiClient | null;
  interaction?: ReturnType<typeof makeInteraction>;
  context?: UserInteractionContext;
}) => {
  const handleLocally = vi.fn(async () => undefined);
  await handleTimestampCommand({ name: 'at', interaction, context, settings, handleLocally, api });
  return { handleLocally, interaction, context, api };
};

/** The text of every text display in a reply, which is where the content and the notes go */
const textsOf = (reply: { components?: { type: number; content?: string }[] }) =>
  (reply.components ?? []).filter(component => component.type === ComponentType.TextDisplay).map(component => component.content);

describe('handleTimestampCommand', () => {
  describe('without an API', () => {
    it('handles the command itself, as before', async () => {
      const { handleLocally, interaction, context } = await run({ api: null });

      expect(handleLocally).toHaveBeenCalledTimes(1);
      expect(interaction.reply).not.toHaveBeenCalled();
      expect(context.commandRecordedByApi).toBeUndefined();
    });
  });

  describe('when the API does not answer', () => {
    it('handles the command itself and leaves the run to be recorded here', async () => {
      const { handleLocally, interaction, context, api } = await run({ result: null });

      expect(api!.run).toHaveBeenCalledTimes(1);
      expect(handleLocally).toHaveBeenCalledTimes(1);
      expect(interaction.reply).not.toHaveBeenCalled();
      expect(context.commandRecordedByApi).toBeUndefined();
    });
  });

  describe('when the API resolves the command', () => {
    it('asks as the user, with the options they gave and nothing else', async () => {
      const interaction = makeInteraction([
        { name: 'hour', value: '9' },
        { name: 'timezone', value: 'GMT+2' },
        { name: 'minute', value: null },
        { name: 'am', value: undefined },
      ]);
      const { api } = await run({ result: timestamp(), interaction });

      expect(api!.run).toHaveBeenCalledWith(expect.anything(), '175928847299117063', 'at', { hour: '9', timezone: 'GMT+2' });
    });

    it('replies with what the API resolved, without handling the command itself', async () => {
      const { handleLocally, interaction } = await run({ result: timestamp() });

      expect(handleLocally).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledTimes(1);
      const reply = interaction.reply.mock.calls[0][0];
      expect(reply.flags).toBe(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral);
      expect(textsOf(reply)[0]).toBe('📅 2022-04-24\n`<t:1650802953:f>` → <t:1650802953:f>');
      // The format picker the bot adds around every reply that lists all formats
      expect(reply.components.some((component: { type: number }) => component.type === ComponentType.ActionRow)).toBe(true);
    });

    it('puts the run count in the reply, and marks the run as recorded so it is not counted twice', async () => {
      const { interaction, context } = await run({ result: timestamp() });

      const reply = interaction.reply.mock.calls[0][0];
      const texts = textsOf(reply);
      expect(texts[texts.length - 1]).toContain('execution #7');
      expect(texts[texts.length - 1]).toContain('[Privacy Policy](<https://example.test/legal>)');
      expect(context.commandRecordedByApi).toBe(true);
    });

    it('keeps the note at the very end of the reply', async () => {
      const { interaction } = await run({ result: timestamp() });

      const { components } = interaction.reply.mock.calls[0][0];
      expect(components[components.length - 1].type).toBe(ComponentType.TextDisplay);
      expect(components[components.length - 2].type).toBe(ComponentType.Separator);
    });

    it('has no note when the account opted out', async () => {
      const { interaction, context } = await run({
        result: timestamp({ telemetry: undefined }),
        settings: { ...defaultSettings, telemetry: false } as SettingsValue,
      });

      const reply = interaction.reply.mock.calls[0][0];
      expect(textsOf(reply).join('\n')).not.toContain('execution #');
      expect(textsOf(reply).join('\n')).not.toContain('Privacy Policy');
      expect(context.commandRecordedByApi).toBe(true);
    });

    it('thanks the user without a count when the API could not record the run', async () => {
      const { interaction } = await run({ result: timestamp({ telemetry: undefined }) });

      const texts = textsOf(interaction.reply.mock.calls[0][0]);
      expect(texts[texts.length - 1]).toContain('Privacy Policy');
      expect(texts[texts.length - 1]).not.toContain('execution #');
    });

    it('replies with just the preview when the API says the reply is minimal', async () => {
      const { interaction } = await run({ result: timestamp({ singleFormat: 'R', minimalReply: true, header: null, content: '<t:1650802953:R>' }) });

      expect(interaction.reply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral, content: '<t:1650802953:R>' });
    });

    it('hints at at12 when the hour was a bare 24-hour value', async () => {
      const withHint = await run({ result: timestamp({ usingAtHoursOnly: true }) });
      const without = await run({ result: timestamp({ usingAtHoursOnly: false }) });

      expect(textsOf(withHint.interaction.reply.mock.calls[0][0]).length).toBe(textsOf(without.interaction.reply.mock.calls[0][0]).length + 1);
    });

    it('does not make the reply public unless the user asked for that', async () => {
      const interaction = makeInteraction();
      (interaction.options as unknown as { getBoolean: () => boolean }).getBoolean = () => false;
      const { interaction: replied } = await run({ result: timestamp(), interaction });

      expect(replied.reply.mock.calls[0][0].flags & MessageFlags.Ephemeral).toBe(0);
    });
  });

  describe('when the API rejects the input', () => {
    const rejected: CommandsApiResult = { type: 'rejected', error: { error: 'commands.at.responses.hourRange' } };

    it('tells the user why, in the language of the bot', async () => {
      const { handleLocally, interaction } = await run({ result: rejected });

      expect(handleLocally).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(interaction.reply.mock.calls[0][0])).toContain('hour must be a number between 0 and 23');
    });

    it('leaves the run to be recorded as the bot always did for a rejected input', async () => {
      const { context } = await run({ result: rejected });

      expect(context.commandRecordedByApi).toBeUndefined();
    });

    it('words an unsupported timezone like the bot does, with the hint when a timezone is saved', async () => {
      const error: CommandsApiResult = { type: 'rejected', error: { error: 'commands.global.responses.unsupportedTimezone', params: { timezone: 'Nowhere' } } };

      const plain = await run({ result: error });
      const withSetting = await run({ result: error, settings: { ...defaultSettings, timezone: 'GMT+2' } as SettingsValue });

      expect(JSON.stringify(plain.interaction.reply.mock.calls[0][0])).toContain('The provided timezone (Nowhere) is not supported');
      expect(JSON.stringify(plain.interaction.reply.mock.calls[0][0])).not.toContain('/settings');
      expect(JSON.stringify(withSetting.interaction.reply.mock.calls[0][0])).toContain('/settings');
    });
  });
});
