import { describe, expect, it } from 'vitest';
import {
  CommandResult,
  isCommandError,
  resolveAdd,
  resolveAgo,
  resolveAt,
  resolveAt12,
  resolveIn,
  resolveIso,
  resolveSnowflake,
  resolveSubtract,
  resolveUnix,
} from './resolvers.js';
import { defaultSettings } from './settings.js';

const nowMs = Date.parse('2022-04-24T12:22:33.000Z');
const unixOf = (iso: string) => Date.parse(iso) / 1000;

const expectDate = (result: CommandResult) => {
  if (isCommandError(result)) {
    throw new Error(`Unexpected error ${result.error}`);
  }
  return { unix: result.date.getTime() / 1000, timezone: result.timezone, usingAtHoursOnly: result.usingAtHoursOnly };
};

describe('resolveAt', () => {
  it('should default to GMT and the current date', () => {
    expect(expectDate(resolveAt({ hour: '15', minute: 5 }, defaultSettings, nowMs))).toEqual({
      unix: unixOf('2022-04-24T15:05:00Z'),
      timezone: 'GMT',
      usingAtHoursOnly: true,
    });
  });

  it('should apply the timezone option', () => {
    expect(expectDate(resolveAt({ hour: '9', minute: 0, timezone: 'GMT+2' }, defaultSettings, nowMs)).unix)
      .toEqual(unixOf('2022-04-24T07:00:00Z'));
  });

  it('should fall back to the timezone setting', () => {
    const settings = { ...defaultSettings, timezone: 'GMT-5' };
    expect(expectDate(resolveAt({ hour: '9', minute: 0 }, settings, nowMs)).unix)
      .toEqual(unixOf('2022-04-24T14:00:00Z'));
  });

  it('should use the default minute and second settings', () => {
    const settings = { ...defaultSettings, defaultAtMinute: 30, defaultAtSecond: 15 };
    expect(expectDate(resolveAt({ hour: '9' }, settings, nowMs)).unix).toEqual(unixOf('2022-04-24T09:30:15Z'));
  });

  it('should set explicit date components', () => {
    expect(expectDate(resolveAt({ year: 2030, month: 12, day: 31, hour: '23', minute: 59, second: 58 }, defaultSettings, nowMs)).unix)
      .toEqual(unixOf('2030-12-31T23:59:58Z'));
  });

  it('should not flag bare hours when a meridiem is used', () => {
    expect(expectDate(resolveAt({ hour: '3pm', minute: 0 }, defaultSettings, nowMs)))
      .toMatchObject({ unix: unixOf('2022-04-24T15:00:00Z'), usingAtHoursOnly: false });
  });

  it('should report hour errors', () => {
    expect(resolveAt({ hour: '25' }, defaultSettings, nowMs)).toEqual({ error: 'commands.at.responses.hourRange' });
    expect(resolveAt({ hour: '5', hour12: 5 }, defaultSettings, nowMs))
      .toEqual({ error: 'commands.at.responses.hourOrHour12Only' });
  });

  it('should report unsupported timezones', () => {
    expect(resolveAt({ hour: '5', timezone: 'Nowhere/Land' }, defaultSettings, nowMs)).toEqual({
      error: 'commands.global.responses.unsupportedTimezone',
      params: { timezone: 'Nowhere/Land' },
    });
  });
});

describe('resolveAt12', () => {
  it('should convert pm hours', () => {
    expect(expectDate(resolveAt12({ hour: 3, pm: true, minute: 0 }, defaultSettings, nowMs)).unix)
      .toEqual(unixOf('2022-04-24T15:00:00Z'));
  });

  it('should convert 12 am to midnight', () => {
    expect(expectDate(resolveAt12({ hour: 12, am: true, minute: 0 }, defaultSettings, nowMs)).unix)
      .toEqual(unixOf('2022-04-24T00:00:00Z'));
  });

  it('should require exactly one meridiem', () => {
    expect(resolveAt12({ hour: 3 }, defaultSettings, nowMs)).toEqual({ error: 'commands.at12.responses.meridiemRequired' });
    expect(resolveAt12({ hour: 3, am: true, pm: true }, defaultSettings, nowMs))
      .toEqual({ error: 'commands.at12.responses.amOrPmOnly' });
  });
});

describe('resolveIso', () => {
  it('should parse a valid value', () => {
    expect(expectDate(resolveIso({ value: '2022-04-24T10:00:00Z' }, defaultSettings)).unix)
      .toEqual(unixOf('2022-04-24T10:00:00Z'));
  });

  it('should reject an invalid value', () => {
    expect(resolveIso({ value: 'not a date' }, defaultSettings)).toEqual({ error: 'commands.iso.responses.invalidIsoFormat' });
  });
});

describe('resolveUnix', () => {
  it('should convert seconds to a date without a timezone', () => {
    expect(expectDate(resolveUnix({ value: 1650802953 }))).toEqual({
      unix: 1650802953,
      timezone: undefined,
      usingAtHoursOnly: undefined,
    });
  });
});

describe('resolveSnowflake', () => {
  it('should extract the creation time', () => {
    expect(expectDate(resolveSnowflake({ value: '175928847299117063' })).unix).toEqual(1462015105);
  });

  it('should reject invalid snowflakes', () => {
    expect(resolveSnowflake({ value: 'abc' })).toEqual({ error: 'commands.snowflake.responses.invalidSnowflake' });
  });
});

describe('relative commands', () => {
  it('in should add to the current time in UTC', () => {
    expect(expectDate(resolveIn({ hours: 1 }, nowMs))).toMatchObject({ unix: nowMs / 1000 + 3600, timezone: 'UTC' });
  });

  it('ago should subtract from the current time in UTC', () => {
    expect(expectDate(resolveAgo({ minutes: 30 }, nowMs))).toMatchObject({ unix: nowMs / 1000 - 1800, timezone: 'UTC' });
  });

  it('in and ago should require at least one component', () => {
    const expected = { error: 'commands.global.responses.noComponentsCurrentTime', params: { atCommand: 'at' } };
    expect(resolveIn({}, nowMs)).toEqual(expected);
    expect(resolveAgo({ days: 0, hours: null }, nowMs)).toEqual(expected);
  });

  it('add should offset the given timestamp', () => {
    expect(expectDate(resolveAdd({ to: 0, days: 1 }))).toMatchObject({ unix: 86400, timezone: undefined });
  });

  it('subtract should offset the given timestamp', () => {
    expect(expectDate(resolveSubtract({ from: 86400, days: 1 })).unix).toEqual(0);
  });

  it('add and subtract should require at least one component', () => {
    const expected = { error: 'commands.global.responses.noComponentsUnix', params: { unixCommand: 'unix' } };
    expect(resolveAdd({ to: 0 })).toEqual(expected);
    expect(resolveSubtract({ from: 0 })).toEqual(expected);
  });
});
