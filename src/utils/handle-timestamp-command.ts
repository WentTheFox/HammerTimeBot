import { ChatInputCommandInteraction } from 'discord.js';
import { UserInteractionContext } from '../types/bot-interaction.js';
import { replyWithCommandError } from './command-error.js';
import { commandsApi, CommandsApiClient, CommandsApiTimestamp } from './commands-api.js';
import { buildSyntaxReplyOptions } from './reply-with-syntax.js';
import { SettingsValue } from './settings.js';
import { TelemetryResponse } from './add-telemetry-note-to-reply.js';

/** The options the user provided, by the names of the command's options, which the API uses as its input */
const providedOptions = (interaction: ChatInputCommandInteraction): Record<string, unknown> =>
  Object.fromEntries(interaction.options.data
    .filter(option => option.value !== undefined && option.value !== null)
    .map(option => [option.name, option.value]));

const telemetryOf = (body: CommandsApiTimestamp, settings: SettingsValue): TelemetryResponse | undefined | null => {
  if (!settings.telemetry) {
    return null;
  }

  return body.telemetry ? {
    executionNumber: body.telemetry.executionNumber,
    privacyPolicyUrl: body.telemetry.privacyPolicyUrl,
    commandName: body.telemetry.command,
    commandId: undefined,
  } : undefined;
};

interface HandleTimestampCommandParams {
  /** The name of the command, which is also the name of the API endpoint */
  name: string;
  interaction: ChatInputCommandInteraction;
  context: UserInteractionContext;
  settings: SettingsValue;
  /** How this process handles the command itself, which is what happens when no API is configured or it does not answer */
  handleLocally: () => Promise<void>;
  api?: CommandsApiClient | null;
}

/**
 * Handles one of the timestamp commands by asking the API, when there is one, and by itself when there is none or it
 * does not answer, so the bot keeps working when the API is down.
 *
 * What the API answers is turned into the Discord reply here. The API has recorded the run by then, and the note about
 * that is part of the reply, so the run is marked as recorded and not recorded again afterwards. When the API rejects
 * the input the run is left to be recorded as it always was.
 */
export const handleTimestampCommand = async ({
  name,
  interaction,
  context,
  settings,
  handleLocally,
  api = commandsApi,
}: HandleTimestampCommandParams): Promise<void> => {
  const result = api ? await api.run(context.logger, interaction.user.id, name, providedOptions(interaction)) : null;
  if (!result) {
    await handleLocally();
    return;
  }

  if (result.type === 'rejected') {
    await replyWithCommandError(context, interaction, settings, result.error);
    return;
  }

  context.commandRecordedByApi = true;
  await interaction.reply(buildSyntaxReplyOptions({
    rendered: result.body,
    interaction,
    context,
    settings,
    usingAtHoursOnly: result.body.usingAtHoursOnly,
    telemetry: { type: 'recorded', response: telemetryOf(result.body, settings) },
  }));
};
