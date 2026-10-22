import {
  adjustDate,
  constrain,
  convertHour12To24,
  defaultHourOptions,
  findHours,
  findTimezone,
  formattedResponse,
  getGmtTimezoneValue,
  gmtTimezoneOptions,
  supportedFormats,
} from './time.js';
import { MessageTimestamp, MessageTimestampFormat } from './message-timestamp.js';
import { TimezoneError } from './timezone-error.js';
import { ResponseColumnChoices } from './settings.js';
import { pad } from './numbers.js';
import { describe, expect, it } from 'vitest';
import { TZDate } from '@date-fns/tz';
import { addHours, format, getHours, subDays } from 'date-fns';

describe('time utils', () => {
  const now = new Date('2022-04-24T12:22:33.000Z');
  const ts = new MessageTimestamp(now);

  describe('pad', () => {
    it('should pad to the specified length with zeroes', () => {
      expect(pad(0, 2)).toEqual('00');
      expect(pad(1, 2)).toEqual('01');
      expect(pad(2, 4)).toEqual('0002');
    });

    it('should stringify sufficiently long numbers without padding', () => {
      expect(pad(10, 2)).toEqual('10');
      expect(pad(100, 3)).toEqual('100');
      expect(pad(9999, 4)).toEqual('9999');
    });

    it('should stringify longer numbers', () => {
      expect(pad(10, 1)).toEqual('10');
      expect(pad(100, 2)).toEqual('100');
      expect(pad(9999, 3)).toEqual('9999');
    });
  });

  describe('findTimezone', () => {
    it('should find exact match', () => {
      expect(findTimezone('GMT')).toEqual(gmtTimezoneOptions);
      expect(findTimezone('gmt')).toEqual(gmtTimezoneOptions);
    });

    it('should find partial match', () => {
      expect(findTimezone('gmt+')).toEqual(['GMT+1', 'GMT+2', 'GMT+3', 'GMT+4', 'GMT+5', 'GMT+6', 'GMT+7', 'GMT+8', 'GMT+9', 'GMT+10', 'GMT+11', 'GMT+12', 'GMT+13', 'GMT+14', 'GMT+15', 'GMT+16']);
      expect(findTimezone('gmt+2')).toEqual(['GMT+2', 'GMT+2:10', 'GMT+2:20', 'GMT+2:30', 'GMT+2:40', 'GMT+2:50']);
      expect(findTimezone('gmt-1')).toEqual([
        'GMT-1',
        'GMT-1:10',
        'GMT-1:20',
        'GMT-1:30',
        'GMT-1:40',
        'GMT-1:50',
        'GMT-10',
        'GMT-10:10',
        'GMT-10:20',
        'GMT-10:30',
        'GMT-10:40',
        'GMT-10:50',
        'GMT-11',
        'GMT-11:10',
        'GMT-11:20',
        'GMT-11:30',
        'GMT-11:40',
        'GMT-11:50',
        'GMT-12',
        'GMT-12:10',
        'GMT-13',
        'GMT-14',
        'GMT-15',
        'GMT-16',
      ]);
      expect(findTimezone('gmt-12')).toEqual([
        'GMT-12',
        'GMT-12:10',
        'GMT-12:20',
        'GMT-12:30',
        'GMT-12:40',
        'GMT-12:50',
      ]);
      expect(findTimezone('gmt+5:30')).toEqual(['GMT+5:30']);
      expect(findTimezone('gmt+5:1')).toEqual([
        'GMT+5:10',
        'GMT+5:11',
        'GMT+5:12',
        'GMT+5:13',
        'GMT+5:14',
        'GMT+5:15',
        'GMT+5:16',
        'GMT+5:17',
        'GMT+5:18',
        'GMT+5:19',
      ]);
      expect(findTimezone('budapest')).toEqual(['Europe/Budapest']);
      expect(findTimezone('london')).toEqual(['Europe/London']);
      expect(findTimezone('los angeles')).toEqual(['America/Los_Angeles']);
      expect(findTimezone('buenos aires')).toEqual(['America/Buenos_Aires']);
      expect(findTimezone('madrid')).toEqual(['Europe/Madrid']);
      expect(findTimezone('tokyo')).toEqual(['Asia/Tokyo']);
      expect(findTimezone('warsaw')).toEqual(['Europe/Warsaw']);
    });

    it('should throw on failure', () => {
      const invalidInput = 'neverland';
      expect(() => findTimezone(invalidInput)).toThrow(new TimezoneError(invalidInput));
    });
  });

  describe('formattedResponse', () => {
    it('should return all supported formats', () => {
      const actual = formattedResponse(ts, supportedFormats, ResponseColumnChoices.BOTH, null);
      expect(actual).toMatchSnapshot();
    });

    it('should return all supported formats without bold formatting', () => {
      const actual = formattedResponse(ts, supportedFormats, ResponseColumnChoices.BOTH, false);
      expect(actual).toMatchSnapshot();
    });

    it('should return only requested format', () => {
      const actual = formattedResponse(ts, [MessageTimestampFormat.RELATIVE], ResponseColumnChoices.BOTH, null);
      expect(actual).toMatchSnapshot();
    });

    it('should return only previews', () => {
      const actual = formattedResponse(ts, supportedFormats, ResponseColumnChoices.PREVIEW_ONLY, null);
      expect(actual).toMatchSnapshot();
    });

    it('should return only previews without bold formatting', () => {
      const actual = formattedResponse(ts, supportedFormats, ResponseColumnChoices.PREVIEW_ONLY, false);
      expect(actual).toMatchSnapshot();
    });

    it('should return only syntaxes', () => {
      const actual = formattedResponse(ts, supportedFormats, ResponseColumnChoices.SYNTAX_ONLY, null);
      expect(actual).toMatchSnapshot();
    });

    it('should return preview only in requested format', () => {
      const actual = formattedResponse(ts, [MessageTimestampFormat.RELATIVE], ResponseColumnChoices.PREVIEW_ONLY, null);
      expect(actual).toMatchSnapshot();
    });

    it('should return preview only in requested format without bold formatting', () => {
      const actual = formattedResponse(ts, [MessageTimestampFormat.RELATIVE], ResponseColumnChoices.PREVIEW_ONLY, false);
      expect(actual).toMatchSnapshot();
    });
  });

  describe('adjustDate', () => {
    it('should add the specified time', () => {
      const actual = adjustDate({ hours: 10 }, 'add', now);
      const expected = addHours(new TZDate(now), 10);
      expect(getHours(actual)).toEqual(getHours(expected));
    });

    it('should subtract the specified time', () => {
      const actual = adjustDate({ days: 3 }, 'subtract', now);
      const expected = subDays(now, 3);
      expect(format(actual, 'yyyy-MM-dd')).toEqual(format(expected, 'yyyy-MM-dd'));
    });
  });

  describe('constrain', () => {
    it('should work without upper bound', () => {
      expect(constrain(-1, 0)).toEqual(0);
      expect(constrain(0, 0)).toEqual(0);
      expect(constrain(10, 20)).toEqual(20);
      expect(constrain(20, 20)).toEqual(20);
      expect(constrain(1, 0)).toEqual(1);
      expect(constrain(22, 20)).toEqual(22);
    });

    it('should work with upper bound', () => {
      expect(constrain(-1, 0, 1)).toEqual(0);
      expect(constrain(0, 0, 1)).toEqual(0);
      expect(constrain(10, 20, 30)).toEqual(20);
      expect(constrain(20, 20, 30)).toEqual(20);
      expect(constrain(1, 0, 2)).toEqual(1);
      expect(constrain(22, 20, 25)).toEqual(22);

      expect(constrain(3, 0, 5)).toEqual(3);
      expect(constrain(5, 0, 5)).toEqual(5);
      expect(constrain(10, 0, 5)).toEqual(5);
    });
  });
});

describe('getGmtTimezoneValue', () => {
  it('should work for simple hours input', () => {
    expect(getGmtTimezoneValue('GMT+1')).toEqual({ hours: 1, minutes: 0 });
    expect(getGmtTimezoneValue('GMT-1')).toEqual({ hours: -1, minutes: 0 });
    expect(getGmtTimezoneValue('GMT+10')).toEqual({ hours: 10, minutes: 0 });
    expect(getGmtTimezoneValue('GMT-10')).toEqual({ hours: -10, minutes: 0 });
    expect(getGmtTimezoneValue('GMT+69')).toEqual({ hours: 69, minutes: 0 });
    expect(getGmtTimezoneValue('GMT-420')).toEqual({ hours: -420, minutes: 0 });
  });
  it('should work for minute input', () => {
    expect(getGmtTimezoneValue('GMT+1:00')).toEqual({ hours: 1, minutes: 0 });
    expect(getGmtTimezoneValue('GMT-1:00')).toEqual({ hours: -1, minutes: 0 });
    expect(getGmtTimezoneValue('GMT+5:05')).toEqual({ hours: 5, minutes: 5 });
    expect(getGmtTimezoneValue('GMT-5:05')).toEqual({ hours: -5, minutes: 5 });
    expect(getGmtTimezoneValue('GMT+10:59')).toEqual({ hours: 10, minutes: 59 });
    expect(getGmtTimezoneValue('GMT-10:59')).toEqual({ hours: -10, minutes: 59 });
    expect(getGmtTimezoneValue('GMT+69:30')).toEqual({ hours: 69, minutes: 30 });
    expect(getGmtTimezoneValue('GMT-420:42')).toEqual({ hours: -420, minutes: 42 });
  });
  it('should work for partial input', () => {
    expect(getGmtTimezoneValue('GMT+1:')).toEqual({ hours: 1, minutes: 0 });
    expect(getGmtTimezoneValue('GMT+3:3')).toEqual({ hours: 3, minutes: 30 });
    expect(getGmtTimezoneValue('GMT+5:5')).toEqual({ hours: 5, minutes: 50 });
    expect(getGmtTimezoneValue('GMT+10:')).toEqual({ hours: 10, minutes: 0 });
    expect(getGmtTimezoneValue('GMT+69:0')).toEqual({ hours: 69, minutes: 0 });
  });
});

describe('convertHour12To24', () => {
  it('should work when am is true and pm is null', () => {
    expect(convertHour12To24(12, true, null)).toEqual(0);
    expect(convertHour12To24(1, true, null)).toEqual(1);
    expect(convertHour12To24(2, true, null)).toEqual(2);
    expect(convertHour12To24(3, true, null)).toEqual(3);
    expect(convertHour12To24(4, true, null)).toEqual(4);
    expect(convertHour12To24(5, true, null)).toEqual(5);
    expect(convertHour12To24(6, true, null)).toEqual(6);
    expect(convertHour12To24(7, true, null)).toEqual(7);
    expect(convertHour12To24(8, true, null)).toEqual(8);
    expect(convertHour12To24(9, true, null)).toEqual(9);
    expect(convertHour12To24(10, true, null)).toEqual(10);
    expect(convertHour12To24(11, true, null)).toEqual(11);
  });
  it('should work when am is null and pm is false', () => {
    expect(convertHour12To24(12, null, false)).toEqual(0);
    expect(convertHour12To24(1, null, false)).toEqual(1);
    expect(convertHour12To24(2, null, false)).toEqual(2);
    expect(convertHour12To24(3, null, false)).toEqual(3);
    expect(convertHour12To24(4, null, false)).toEqual(4);
    expect(convertHour12To24(5, null, false)).toEqual(5);
    expect(convertHour12To24(6, null, false)).toEqual(6);
    expect(convertHour12To24(7, null, false)).toEqual(7);
    expect(convertHour12To24(8, null, false)).toEqual(8);
    expect(convertHour12To24(9, null, false)).toEqual(9);
    expect(convertHour12To24(10, null, false)).toEqual(10);
    expect(convertHour12To24(11, null, false)).toEqual(11);
  });
  it('should work when am is false and pm is null', () => {
    expect(convertHour12To24(12, false, null)).toEqual(12);
    expect(convertHour12To24(1, false, null)).toEqual(13);
    expect(convertHour12To24(2, false, null)).toEqual(14);
    expect(convertHour12To24(3, false, null)).toEqual(15);
    expect(convertHour12To24(4, false, null)).toEqual(16);
    expect(convertHour12To24(5, false, null)).toEqual(17);
    expect(convertHour12To24(6, false, null)).toEqual(18);
    expect(convertHour12To24(7, false, null)).toEqual(19);
    expect(convertHour12To24(8, false, null)).toEqual(20);
    expect(convertHour12To24(9, false, null)).toEqual(21);
    expect(convertHour12To24(10, false, null)).toEqual(22);
    expect(convertHour12To24(11, false, null)).toEqual(23);
  });
  it('should work when am is null and pm is true', () => {
    expect(convertHour12To24(12, null, true)).toEqual(12);
    expect(convertHour12To24(1, null, true)).toEqual(13);
    expect(convertHour12To24(2, null, true)).toEqual(14);
    expect(convertHour12To24(3, null, true)).toEqual(15);
    expect(convertHour12To24(4, null, true)).toEqual(16);
    expect(convertHour12To24(5, null, true)).toEqual(17);
    expect(convertHour12To24(6, null, true)).toEqual(18);
    expect(convertHour12To24(7, null, true)).toEqual(19);
    expect(convertHour12To24(8, null, true)).toEqual(20);
    expect(convertHour12To24(9, null, true)).toEqual(21);
    expect(convertHour12To24(10, null, true)).toEqual(22);
    expect(convertHour12To24(11, null, true)).toEqual(23);
  });
});

describe('findHours', () => {
  it('should return the all hours for 24-hour clock by default', () => {
    expect(findHours('')).toEqual(defaultHourOptions);
  });
  it('should return matching hours for all clock types', () => {
    expect(findHours('1')).toEqual([
      '1',
      '1am',
      '1pm',
      '10',
      '10am',
      '10pm',
      '11',
      '11am',
      '11pm',
      '12',
      '12am',
      '12pm',
      '13',
      '14',
      '15',
      '16',
      '17',
      '18',
      '19',
    ]);
    expect(findHours('2')).toEqual([
      '2',
      '2am',
      '2pm',
      '20',
      '21',
      '22',
      '23',
    ]);
    expect(findHours('3')).toEqual([
      '3',
      '3am',
      '3pm',
    ]);
    expect(findHours('10')).toEqual([
      '10',
      '10am',
      '10pm',
    ]);
    expect(findHours('12')).toEqual([
      '12',
      '12am',
      '12pm',
    ]);
    expect(findHours('13')).toEqual([
      '13',
    ]);
    expect(findHours('20')).toEqual([
      '20',
    ]);
  });
});
