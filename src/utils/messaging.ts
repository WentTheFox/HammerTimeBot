import {
  ApplicationCommandOptionType,
  AutocompleteInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  CommandInteraction,
  CommandInteractionOption,
  Embed,
  TopLevelComponent,
  User,
} from 'discord.js';
import { AtCommandOptionName, GlobalCommandOptionName } from '../types/localization.js';
import { SettingsValue } from './settings.js';
import { TFunction } from 'i18next';
import { defaultHour12Options, defaultHourOptions, findHours, findTimezone, gmtTimezoneOptions } from './time.js';
import { TimezoneError } from '../classes/timezone-error.js';
import { MessageFlags } from 'discord-api-types/v10';
import { interactionReply } from './interaction-reply.js';
import { InteractionHandlerContext, LoggerContext } from '../types/bot-interaction.js';

type UserFriendCode = `@${string}` | `${string}#${string}`;
export const getUserFriendCode = (user: User): UserFriendCode => {
  return user.discriminator === '0' ? `@${user.username}` : `${user.username}#${user.discriminator}`;
};

export const getUserIdentifier = (user: User): `${UserFriendCode} (${string})` => {
  return `${getUserFriendCode(user)} (${user.id})`;
};

export const stringifyChannelName = (channelId: string, channel?: CommandInteraction['channel']): string => {
  if (channel) {
    let stringName: string;
    if (channel.type === ChannelType.GuildText && 'name' in channel) {
      stringName = `#${channel.name}`;
    } else {
      stringName = channel.toString();
    }

    return `${stringName} (${channel.id})`;
  }

  return `Channel#${channelId}`;
};

export const stringifyGuildName = (guildId: string | null, guild: CommandInteraction['guild']): string => {
  if (guild?.name) {
    return `${guild.name} (${guild.id})`;
  }

  const potentialGuildId = guild?.id ?? guildId;
  if (potentialGuildId) {
    return `Guild#${guildId}`;
  }

  return '(unknown guild)';
};

export const stringifyOptionsData = (data: readonly CommandInteractionOption[]): string => data.map((option): string => {
  const optionName = option.name;
  let optionValue: string | number | boolean | null | undefined = option.value;
  switch (option.type) {
    case ApplicationCommandOptionType.Channel:
      if (option.channel) optionValue = `${option.channel.type === ChannelType.GuildText ? '#' : ''}${option.channel.name}`;
      break;
    case ApplicationCommandOptionType.User:
      if (option.user) optionValue = getUserIdentifier(option.user);
      break;
    case ApplicationCommandOptionType.Role:
      if (option.role) optionValue = `@${option.role.name}`;
      break;
    case ApplicationCommandOptionType.Subcommand:
      optionValue = option.options ? stringifyOptionsData(option.options) : null;
      break;
  }
  return `(${optionName}${optionValue !== null ? `:${optionValue}` : ''})`;
}).join(' ');

// TODO Remove and make fallback value of `isEphemeralResponse` after notice is removed
export const EPHEMERAL_OPTION_DEFAULT_VALUE = true;

export const isEphemeralResponse = (
  interaction: ChatInputCommandInteraction,
  settings: Pick<SettingsValue, 'ephemeral'> | undefined,
): boolean | null => interaction.options.getBoolean(GlobalCommandOptionName.EPHEMERAL) ?? settings?.ephemeral ?? null;

type BareNumberFormatter = Pick<Intl.NumberFormat, 'format'>;
const numberFormatterCache: Partial<Record<string, BareNumberFormatter>> = {};
export const getBareNumberFormatter = (interaction: Pick<CommandInteraction, 'locale'>, { logger }: LoggerContext) => {
  let numberFormatter: BareNumberFormatter | undefined = numberFormatterCache[interaction.locale];
  if (!numberFormatter) {
    numberFormatter = { format: (value: number): string => value.toString() };
    try {
      numberFormatter = new Intl.NumberFormat(interaction.locale);
    } catch (e) {
      logger.error(`Failed to create number formatter with locale ${interaction.locale}`);
      logger.error(e);
    }
    numberFormatterCache[interaction.locale] = numberFormatter;
  }
  return numberFormatter;
};

/**
 * Normally this is able to always return some kind of value, so if we get null the code flow should be terminated
 */
export const findTimezoneOptionValue = async (t: TFunction, interaction: ChatInputCommandInteraction, settings: SettingsValue): Promise<string | null> => {
  const timezoneInput = interaction.options.getString(GlobalCommandOptionName.TIMEZONE);
  // Apply user's timezone settings, if available
  let timezone = settings.timezone ?? 'GMT';
  if (timezoneInput) {
    try {
      timezone = findTimezone(timezoneInput)[0];
    } catch (e) {
      if (!(e instanceof TimezoneError)) {
        throw e;
      }
      await interactionReply(t, interaction, {
        content: t('commands.global.responses.timezoneNotFound'),
        flags: MessageFlags.Ephemeral,
      });
      return null;
    }
  }
  return timezone;
};

export const handleTimezoneAutocomplete = async (interaction: AutocompleteInteraction) => {
  const value = interaction.options.getString(GlobalCommandOptionName.TIMEZONE)?.trim();
  let tzNames: string[];
  if (typeof value !== 'string' || value.length === 0) {
    tzNames = gmtTimezoneOptions;
  } else {
    try {
      tzNames = findTimezone(value);
    } catch (e) {
      if (!(e instanceof TimezoneError)) {
        throw e;
      }
      await interaction.respond([]);
      return;
    }
  }

  await interaction.respond(tzNames.slice(0, 25).map(name => ({ name, value: name })));
};

export const handleHourAutocomplete = async (interaction: AutocompleteInteraction) => {
  const value = interaction.options.getString(AtCommandOptionName.HOUR)?.trim();
  const am = interaction.options.getBoolean(AtCommandOptionName.AM);
  const pm = interaction.options.getBoolean(AtCommandOptionName.PM);
  const amOrPmUsed = am !== null || pm !== null;
  let options: string[];
  if (typeof value !== 'string' || value.length === 0) {
    options = amOrPmUsed ? defaultHour12Options : defaultHourOptions;
  } else {
    options = findHours(value, amOrPmUsed);
  }

  await interaction.respond(options.slice(0, 25).map(name => ({ name, value: name })));
};

export type EmbedTextData = Partial<Pick<Embed, 'title' | 'description' | 'footer' | 'fields'>>;

export const findEmbedsTextFields = (embeds: EmbedTextData[]) =>
  embeds.reduce((acc, embed) => {
    if (embed.title) {
      acc.push(embed.title);
    }
    if (embed.description) {
      acc.push(embed.description);
    }
    if (embed.footer?.text) {
      acc.push(embed.footer.text);
    }
    if (embed.fields) {
      embed.fields.forEach(field => {
        if (field.name) {
          acc.push(field.name);
        }
        if (field.value) {
          acc.push(field.value);
        }
      });
    }
    return acc;
  }, [] as string[]);

export const findTextComponentContentsRecursively = (components: TopLevelComponent[]): string[] =>
  components.reduce((contents, component) => {
    if ('content' in component) {
      contents.push(component.content);
    }
    if ('components' in component) {
      return [
        ...contents,
        ...findTextComponentContentsRecursively(component.components as TopLevelComponent[]),
      ];
    }
    return contents;
  }, [] as string[]);

export const emoji = (context: Pick<InteractionHandlerContext, 'emojiIdMap'>, name: string, animated = false): string => {
  return `<${animated ? 'a' : ''}:${name}:${context.emojiIdMap[name]}>`;
};
