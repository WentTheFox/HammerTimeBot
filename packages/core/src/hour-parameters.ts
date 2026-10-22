import { SettingsValue } from './settings.js';
import { convertHour12To24 } from './time.js';

/**
 * Translation keys (under the bot's locale files) describing why the hour parameters were rejected,
 * so each consumer decides how to present the message.
 */
export const hourParameterErrorKeys = [
  'commands.at.responses.hourOrHour12Only',
  'commands.at.responses.noAmOrPmWithMeridiem',
  'commands.at.responses.hour12Range',
  'commands.at.responses.hourRange',
  'commands.at.responses.amOrPmOnly',
  'commands.at.responses.meridiemRequired',
] as const;

export type HourParameterErrorKey = typeof hourParameterErrorKeys[number];

export interface HourParameterError {
  error: HourParameterErrorKey;
}

export const isHourParameterError = (value: unknown): value is HourParameterError =>
  typeof value === 'object' && value !== null && 'error' in value;

interface ProcessMixedHourParametersOptions {
  settings: Pick<SettingsValue, 'defaultAtHour' | 'defaultAt12Hour'>;
  hourStr: string | null;
  hour12: number | null;
  am: boolean | null;
  pm: boolean | null;
}

export const processMixedHourParameters = ({
  settings,
  hourStr,
  hour12: hour12Input,
  am,
  pm,
}: ProcessMixedHourParametersOptions): number | null | HourParameterError => {
  let meridiemParamUsed = am !== null || pm !== null;
  let hour: number | null = settings.defaultAtHour;
  let hour12: number | null = hour12Input;
  if (hourStr !== null && hour12 !== null) {
    return { error: 'commands.at.responses.hourOrHour12Only' };
  }
  const hourStrRegex = /^(-?\d{1,2})([ap]m)?$/;
  if (hourStr !== null) {
    const hourStrMatch = hourStr.toLowerCase().match(hourStrRegex);
    if (hourStrMatch) {
      hour = parseInt(hourStrMatch[1], 10);
      if (hourStrMatch[2]) {
        if (meridiemParamUsed) {
          return { error: 'commands.at.responses.noAmOrPmWithMeridiem' };
        }
        am = hourStrMatch[2] === 'am';
        meridiemParamUsed = true;
        hour12 = null;
      }
    }
    if (hour === null || hour < 0 || hour > 23) {
      return { error: meridiemParamUsed ? 'commands.at.responses.hour12Range' : 'commands.at.responses.hourRange' };
    }
  }
  if (hour === null) {
    hour12 ??= settings.defaultAt12Hour;
  }
  if (meridiemParamUsed || hour12 !== null) {
    if (am !== null && pm !== null) {
      return { error: 'commands.at.responses.amOrPmOnly' };
    }
    if (hour12 !== null) {
      if (am === null && pm === null) {
        return { error: 'commands.at.responses.meridiemRequired' };
      }
      hour = convertHour12To24(hour12, am, pm);
    } else if (hour !== null) {
      if (hour < 1 || hour > 12) {
        return { error: 'commands.at.responses.hour12Range' };
      }
      hour = convertHour12To24(hour, am, pm);
    }
  }
  return hour;
};
