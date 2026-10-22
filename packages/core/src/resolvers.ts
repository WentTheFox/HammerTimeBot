import { TZDate } from '@date-fns/tz';
import { isValid, setDate, setHours, setMilliseconds, setMinutes, setMonth, setSeconds, setYear } from 'date-fns';
import { atLeastOneNonZeroKey } from './at-least-one-non-zero-key.js';
import { HourParameterErrorKey, isHourParameterError, processMixedHourParameters } from './hour-parameters.js';
import { SettingsValue } from './settings.js';
import { SnowflakeError } from './snowflake-error.js';
import snowflakeToUnix from './snowflake.js';
import { TimezoneError } from './timezone-error.js';
import {
  adjustDate,
  constrain,
  convertHour12To24,
  findTimezone,
  getGmtTimezoneValue,
  gmtZoneRegex,
  TimeMap,
} from './time.js';

/**
 * Locale keys (from the bot's locale files) describing why a command input was rejected, so each consumer
 * decides how to present the message
 */
export type CommandErrorKey =
  | HourParameterErrorKey
  | 'commands.at12.responses.amOrPmOnly'
  | 'commands.at12.responses.meridiemRequired'
  | 'commands.global.responses.invalidDate'
  | 'commands.global.responses.noComponentsCurrentTime'
  | 'commands.global.responses.noComponentsUnix'
  | 'commands.global.responses.unsupportedTimezone'
  | 'commands.iso.responses.invalidIsoFormat'
  | 'commands.snowflake.responses.invalidSnowflake';

export interface CommandError {
  error: CommandErrorKey;
  /** Interpolation values for the locale string */
  params?: Record<string, string>;
}

export const isCommandError = (value: unknown): value is CommandError =>
  typeof value === 'object' && value !== null && 'error' in value;

export interface ResolvedTimestamp {
  date: TZDate;
  /** Timezone the date should be displayed in, undefined when the command has no timezone concept */
  timezone: string | undefined;
  /** Whether the hour was given as a bare 24-hour value, which is worth hinting about */
  usingAtHoursOnly?: boolean;
}

export type CommandResult = ResolvedTimestamp | CommandError;

type Maybe<T> = T | null | undefined;
type SettingsSubset<K extends keyof SettingsValue> = Pick<SettingsValue, K>;

export const resolveTimezone = (
  input: Maybe<string>,
  settings: SettingsSubset<'timezone'>,
): { timezone: string } | CommandError => {
  // When the input is not provided, fall back to the user's timezone setting
  const timezoneInput = input ?? settings.timezone;
  if (!timezoneInput) {
    return { timezone: 'GMT' };
  }
  try {
    return { timezone: findTimezone(timezoneInput)[0] };
  } catch (e) {
    if (!(e instanceof TimezoneError)) {
      throw e;
    }
    return { error: 'commands.global.responses.unsupportedTimezone', params: { timezone: timezoneInput } };
  }
};

interface DateParts {
  year: number | null;
  month: number | null;
  day: number | null;
  hour: number | null;
  minute: number | null;
  second: number | null;
}

const buildLocalDate = (timezone: string, parts: DateParts, nowMs: number): TZDate | CommandError => {
  try {
    let localDate: TZDate;
    if (gmtZoneRegex.test(timezone)) {
      const utcOffset = getGmtTimezoneValue(timezone, 0);
      localDate = TZDate.tz(utcOffset.toString(), nowMs);
    } else {
      localDate = TZDate.tz(timezone, nowMs);
    }
    localDate = setMilliseconds(localDate, 0);
    if (parts.year !== null) localDate = setYear(localDate, constrain(parts.year, 0, 275759));
    if (parts.month !== null) localDate = setMonth(localDate, constrain(parts.month - 1, 0, 11));
    if (parts.day !== null) localDate = setDate(localDate, constrain(parts.day, 1, 31));
    if (parts.hour !== null) localDate = setHours(localDate, constrain(parts.hour, 0, 23));
    if (parts.minute !== null) localDate = setMinutes(localDate, constrain(parts.minute, 0, 59));
    if (parts.second !== null) localDate = setSeconds(localDate, constrain(parts.second, 0, 59));
    return localDate;
  } catch (e) {
    if (e instanceof RangeError && e.message === 'Invalid date') {
      return { error: 'commands.global.responses.invalidDate' };
    }
    throw e;
  }
};

type AtSettings = SettingsSubset<'timezone' | 'defaultAtHour' | 'defaultAt12Hour' | 'defaultAtMinute' | 'defaultAtSecond'>;

/** Inputs use the option names from `commands.json` */
export interface AtInput {
  year?: Maybe<number>;
  month?: Maybe<number>;
  day?: Maybe<number>;
  hour?: Maybe<string>;
  hour12?: Maybe<number>;
  am?: Maybe<boolean>;
  pm?: Maybe<boolean>;
  minute?: Maybe<number>;
  second?: Maybe<number>;
  timezone?: Maybe<string>;
}

export const resolveAt = (input: AtInput, settings: AtSettings, nowMs: number = Date.now()): CommandResult => {
  const hourStr = input.hour ?? null;
  const am = input.am ?? null;
  const pm = input.pm ?? null;
  const minute = input.minute ?? settings.defaultAtMinute;
  const second = input.second ?? settings.defaultAtSecond;

  const hour = processMixedHourParameters({ settings, hourStr, hour12: input.hour12 ?? null, am, pm });
  if (isHourParameterError(hour)) {
    return hour;
  }

  const resolvedTimezone = resolveTimezone(input.timezone, settings);
  if (isCommandError(resolvedTimezone)) {
    return resolvedTimezone;
  }
  const { timezone } = resolvedTimezone;

  const date = buildLocalDate(timezone, {
    year: input.year ?? null,
    month: input.month ?? null,
    day: input.day ?? null,
    hour,
    minute,
    second,
  }, nowMs);
  if (isCommandError(date)) {
    return date;
  }

  const usingAtHoursOnly = (hourStr !== null && !/[ap]m$/.test(hourStr)) && am === null && pm === null;
  return { date, timezone, usingAtHoursOnly };
};

export interface At12Input {
  year?: Maybe<number>;
  month?: Maybe<number>;
  day?: Maybe<number>;
  hour?: Maybe<number>;
  am?: Maybe<boolean>;
  pm?: Maybe<boolean>;
  minute?: Maybe<number>;
  second?: Maybe<number>;
  timezone?: Maybe<string>;
}

export const resolveAt12 = (input: At12Input, settings: AtSettings, nowMs: number = Date.now()): CommandResult => {
  const hour12 = input.hour ?? settings.defaultAt12Hour;
  const minute = input.minute ?? settings.defaultAtMinute;
  const second = input.second ?? settings.defaultAtSecond;
  const am = input.am ?? null;
  const pm = input.pm ?? null;

  if (am !== null && pm !== null) {
    return { error: 'commands.at12.responses.amOrPmOnly' };
  }
  if (am === null && pm === null) {
    return { error: 'commands.at12.responses.meridiemRequired' };
  }

  const hour = convertHour12To24(hour12, am, pm);

  const resolvedTimezone = resolveTimezone(input.timezone, settings);
  if (isCommandError(resolvedTimezone)) {
    return resolvedTimezone;
  }
  const { timezone } = resolvedTimezone;

  const date = buildLocalDate(timezone, {
    year: input.year ?? null,
    month: input.month ?? null,
    day: input.day ?? null,
    hour,
    minute,
    second,
  }, nowMs);
  if (isCommandError(date)) {
    return date;
  }

  return { date, timezone };
};

export interface IsoInput {
  value: string;
  timezone?: Maybe<string>;
}

export const resolveIso = (input: IsoInput, settings: SettingsSubset<'timezone'>): CommandResult => {
  const resolvedTimezone = resolveTimezone(input.timezone, settings);
  if (isCommandError(resolvedTimezone)) {
    return resolvedTimezone;
  }
  const { timezone } = resolvedTimezone;

  const date = TZDate.tz(timezone, input.value);
  if (!isValid(date)) {
    return { error: 'commands.iso.responses.invalidIsoFormat' };
  }

  return { date, timezone };
};

export interface UnixInput {
  value: number;
}

export const resolveUnix = (input: UnixInput): CommandResult => ({
  date: TZDate.tz('UTC', input.value * 1e3),
  timezone: undefined,
});

export interface SnowflakeInput {
  value: string;
}

export const resolveSnowflake = (input: SnowflakeInput): CommandResult => {
  let unixValue;
  try {
    unixValue = snowflakeToUnix(input.value);
  } catch (e) {
    if (e instanceof SnowflakeError) {
      return { error: 'commands.snowflake.responses.invalidSnowflake' };
    }
    throw e;
  }

  return { date: TZDate.tz('UTC', unixValue * 1e3), timezone: undefined };
};

export interface TimeUnitsInput {
  years?: Maybe<number>;
  months?: Maybe<number>;
  days?: Maybe<number>;
  hours?: Maybe<number>;
  minutes?: Maybe<number>;
  seconds?: Maybe<number>;
}

const toTimeMap = (input: TimeUnitsInput): TimeMap => ({
  years: input.years ?? null,
  months: input.months ?? null,
  days: input.days ?? null,
  hours: input.hours ?? null,
  minutes: input.minutes ?? null,
  seconds: input.seconds ?? null,
});

/** Relative timestamps always use a fixed timezone */
const RELATIVE_TIMEZONE = 'UTC';

export const resolveIn = (input: TimeUnitsInput, nowMs: number = Date.now()): CommandResult => {
  const timeMap = toTimeMap(input);
  if (!atLeastOneNonZeroKey(timeMap)) {
    return { error: 'commands.global.responses.noComponentsCurrentTime', params: { atCommand: 'at' } };
  }

  return {
    date: adjustDate(timeMap, 'add', TZDate.tz(RELATIVE_TIMEZONE, nowMs)),
    timezone: RELATIVE_TIMEZONE,
  };
};

export const resolveAgo = (input: TimeUnitsInput, nowMs: number = Date.now()): CommandResult => {
  const timeMap = toTimeMap(input);
  if (!atLeastOneNonZeroKey(timeMap)) {
    return { error: 'commands.global.responses.noComponentsCurrentTime', params: { atCommand: 'at' } };
  }

  return {
    date: adjustDate(timeMap, 'subtract', TZDate.tz(RELATIVE_TIMEZONE, nowMs)),
    timezone: RELATIVE_TIMEZONE,
  };
};

export interface AddInput extends TimeUnitsInput {
  to: number;
}

export const resolveAdd = (input: AddInput): CommandResult => {
  const timeMap = toTimeMap(input);
  if (!atLeastOneNonZeroKey(timeMap)) {
    return { error: 'commands.global.responses.noComponentsUnix', params: { unixCommand: 'unix' } };
  }

  return { date: adjustDate(timeMap, 'add', TZDate.tz('UTC', input.to * 1e3)), timezone: undefined };
};

export interface SubtractInput extends TimeUnitsInput {
  from: number;
}

export const resolveSubtract = (input: SubtractInput): CommandResult => {
  const timeMap = toTimeMap(input);
  if (!atLeastOneNonZeroKey(timeMap)) {
    return { error: 'commands.global.responses.noComponentsUnix', params: { unixCommand: 'unix' } };
  }

  return { date: adjustDate(timeMap, 'subtract', TZDate.tz('UTC', input.from * 1e3)), timezone: undefined };
};
