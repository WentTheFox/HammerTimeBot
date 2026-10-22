import { processMixedHourParameters } from './hour-parameters.js';
import { describe, expect, it } from 'vitest';

describe('processMixedHourParameters', () => {
  const settings = { defaultAtHour: null, defaultAt12Hour: null };
  it('should handle regular numbers on their own', () => {
    expect(processMixedHourParameters({ settings, hourStr: '0', hour12: null, am: null, pm: null })).toEqual(0);
    expect(processMixedHourParameters({ settings, hourStr: '1', hour12: null, am: null, pm: null })).toEqual(1);
    expect(processMixedHourParameters({ settings, hourStr: '2', hour12: null, am: null, pm: null })).toEqual(2);
    expect(processMixedHourParameters({ settings, hourStr: '3', hour12: null, am: null, pm: null })).toEqual(3);
    expect(processMixedHourParameters({ settings, hourStr: '4', hour12: null, am: null, pm: null })).toEqual(4);
    expect(processMixedHourParameters({ settings, hourStr: '5', hour12: null, am: null, pm: null })).toEqual(5);
    expect(processMixedHourParameters({ settings, hourStr: '6', hour12: null, am: null, pm: null })).toEqual(6);
    expect(processMixedHourParameters({ settings, hourStr: '7', hour12: null, am: null, pm: null })).toEqual(7);
    expect(processMixedHourParameters({ settings, hourStr: '8', hour12: null, am: null, pm: null })).toEqual(8);
    expect(processMixedHourParameters({ settings, hourStr: '9', hour12: null, am: null, pm: null })).toEqual(9);
    expect(processMixedHourParameters({ settings, hourStr: '10', hour12: null, am: null, pm: null })).toEqual(10);
    expect(processMixedHourParameters({ settings, hourStr: '11', hour12: null, am: null, pm: null })).toEqual(11);
    expect(processMixedHourParameters({ settings, hourStr: '12', hour12: null, am: null, pm: null })).toEqual(12);
    expect(processMixedHourParameters({ settings, hourStr: '13', hour12: null, am: null, pm: null })).toEqual(13);
    expect(processMixedHourParameters({ settings, hourStr: '14', hour12: null, am: null, pm: null })).toEqual(14);
    expect(processMixedHourParameters({ settings, hourStr: '15', hour12: null, am: null, pm: null })).toEqual(15);
    expect(processMixedHourParameters({ settings, hourStr: '16', hour12: null, am: null, pm: null })).toEqual(16);
    expect(processMixedHourParameters({ settings, hourStr: '17', hour12: null, am: null, pm: null })).toEqual(17);
    expect(processMixedHourParameters({ settings, hourStr: '18', hour12: null, am: null, pm: null })).toEqual(18);
    expect(processMixedHourParameters({ settings, hourStr: '19', hour12: null, am: null, pm: null })).toEqual(19);
    expect(processMixedHourParameters({ settings, hourStr: '20', hour12: null, am: null, pm: null })).toEqual(20);
    expect(processMixedHourParameters({ settings, hourStr: '21', hour12: null, am: null, pm: null })).toEqual(21);
    expect(processMixedHourParameters({ settings, hourStr: '22', hour12: null, am: null, pm: null })).toEqual(22);
    expect(processMixedHourParameters({ settings, hourStr: '23', hour12: null, am: null, pm: null })).toEqual(23);
  });
  it('should handle 12-hour values in hour12 parameter only with am true', () => {
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 12, am: true, pm: null })).toEqual(0);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 1, am: true, pm: null })).toEqual(1);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 2, am: true, pm: null })).toEqual(2);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 3, am: true, pm: null })).toEqual(3);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 4, am: true, pm: null })).toEqual(4);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 5, am: true, pm: null })).toEqual(5);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 6, am: true, pm: null })).toEqual(6);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 7, am: true, pm: null })).toEqual(7);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 8, am: true, pm: null })).toEqual(8);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 9, am: true, pm: null })).toEqual(9);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 10, am: true, pm: null })).toEqual(10);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 11, am: true, pm: null })).toEqual(11);
  });
  it('should handle 12-hour values in hour12 parameter only with pm false', () => {
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 12, am: null, pm: false })).toEqual(0);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 1, am: null, pm: false })).toEqual(1);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 2, am: null, pm: false })).toEqual(2);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 3, am: null, pm: false })).toEqual(3);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 4, am: null, pm: false })).toEqual(4);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 5, am: null, pm: false })).toEqual(5);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 6, am: null, pm: false })).toEqual(6);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 7, am: null, pm: false })).toEqual(7);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 8, am: null, pm: false })).toEqual(8);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 9, am: null, pm: false })).toEqual(9);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 10, am: null, pm: false })).toEqual(10);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 11, am: null, pm: false })).toEqual(11);
  });
  it('should handle 12-hour values in hour12 parameter only with am false', () => {
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 12, am: false, pm: null })).toEqual(12);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 1, am: false, pm: null })).toEqual(13);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 2, am: false, pm: null })).toEqual(14);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 3, am: false, pm: null })).toEqual(15);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 4, am: false, pm: null })).toEqual(16);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 5, am: false, pm: null })).toEqual(17);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 6, am: false, pm: null })).toEqual(18);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 7, am: false, pm: null })).toEqual(19);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 8, am: false, pm: null })).toEqual(20);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 9, am: false, pm: null })).toEqual(21);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 10, am: false, pm: null })).toEqual(22);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 11, am: false, pm: null })).toEqual(23);
  });
  it('should handle 12-hour values in hour12 parameter only with pm true', () => {
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 12, am: null, pm: true })).toEqual(12);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 1, am: null, pm: true })).toEqual(13);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 2, am: null, pm: true })).toEqual(14);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 3, am: null, pm: true })).toEqual(15);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 4, am: null, pm: true })).toEqual(16);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 5, am: null, pm: true })).toEqual(17);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 6, am: null, pm: true })).toEqual(18);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 7, am: null, pm: true })).toEqual(19);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 8, am: null, pm: true })).toEqual(20);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 9, am: null, pm: true })).toEqual(21);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 10, am: null, pm: true })).toEqual(22);
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: 11, am: null, pm: true })).toEqual(23);
  });
  it('should handle 12-hour values in hour parameter', () => {
    expect(processMixedHourParameters({ settings, hourStr: '12am', hour12: null, am: null, pm: null })).toEqual(0);
    expect(processMixedHourParameters({ settings, hourStr: '1am', hour12: null, am: null, pm: null })).toEqual(1);
    expect(processMixedHourParameters({ settings, hourStr: '2am', hour12: null, am: null, pm: null })).toEqual(2);
    expect(processMixedHourParameters({ settings, hourStr: '3am', hour12: null, am: null, pm: null })).toEqual(3);
    expect(processMixedHourParameters({ settings, hourStr: '4am', hour12: null, am: null, pm: null })).toEqual(4);
    expect(processMixedHourParameters({ settings, hourStr: '5am', hour12: null, am: null, pm: null })).toEqual(5);
    expect(processMixedHourParameters({ settings, hourStr: '6am', hour12: null, am: null, pm: null })).toEqual(6);
    expect(processMixedHourParameters({ settings, hourStr: '7am', hour12: null, am: null, pm: null })).toEqual(7);
    expect(processMixedHourParameters({ settings, hourStr: '8am', hour12: null, am: null, pm: null })).toEqual(8);
    expect(processMixedHourParameters({ settings, hourStr: '9am', hour12: null, am: null, pm: null })).toEqual(9);
    expect(processMixedHourParameters({ settings, hourStr: '10am', hour12: null, am: null, pm: null })).toEqual(10);
    expect(processMixedHourParameters({ settings, hourStr: '11am', hour12: null, am: null, pm: null })).toEqual(11);
    expect(processMixedHourParameters({ settings, hourStr: '12pm', hour12: null, am: null, pm: null })).toEqual(12);
    expect(processMixedHourParameters({ settings, hourStr: '1pm', hour12: null, am: null, pm: null })).toEqual(13);
    expect(processMixedHourParameters({ settings, hourStr: '2pm', hour12: null, am: null, pm: null })).toEqual(14);
    expect(processMixedHourParameters({ settings, hourStr: '3pm', hour12: null, am: null, pm: null })).toEqual(15);
    expect(processMixedHourParameters({ settings, hourStr: '4pm', hour12: null, am: null, pm: null })).toEqual(16);
    expect(processMixedHourParameters({ settings, hourStr: '5pm', hour12: null, am: null, pm: null })).toEqual(17);
    expect(processMixedHourParameters({ settings, hourStr: '6pm', hour12: null, am: null, pm: null })).toEqual(18);
    expect(processMixedHourParameters({ settings, hourStr: '7pm', hour12: null, am: null, pm: null })).toEqual(19);
    expect(processMixedHourParameters({ settings, hourStr: '8pm', hour12: null, am: null, pm: null })).toEqual(20);
    expect(processMixedHourParameters({ settings, hourStr: '9pm', hour12: null, am: null, pm: null })).toEqual(21);
    expect(processMixedHourParameters({ settings, hourStr: '10pm', hour12: null, am: null, pm: null })).toEqual(22);
    expect(processMixedHourParameters({ settings, hourStr: '11pm', hour12: null, am: null, pm: null })).toEqual(23);
  });

  it('should read default 12-hour value with am true', () => {
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: true,
      pm: null
    })).toEqual(0);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 1 },
      hourStr: null,
      hour12: null,
      am: true,
      pm: null
    })).toEqual(1);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 2 },
      hourStr: null,
      hour12: null,
      am: true,
      pm: null
    })).toEqual(2);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 3 },
      hourStr: null,
      hour12: null,
      am: true,
      pm: null
    })).toEqual(3);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 4 },
      hourStr: null,
      hour12: null,
      am: true,
      pm: null
    })).toEqual(4);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 5 },
      hourStr: null,
      hour12: null,
      am: true,
      pm: null
    })).toEqual(5);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 6 },
      hourStr: null,
      hour12: null,
      am: true,
      pm: null
    })).toEqual(6);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 7 },
      hourStr: null,
      hour12: null,
      am: true,
      pm: null
    })).toEqual(7);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 8 },
      hourStr: null,
      hour12: null,
      am: true,
      pm: null
    })).toEqual(8);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 9 },
      hourStr: null,
      hour12: null,
      am: true,
      pm: null
    })).toEqual(9);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 10 },
      hourStr: null,
      hour12: null,
      am: true,
      pm: null
    })).toEqual(10);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 11 },
      hourStr: null,
      hour12: null,
      am: true,
      pm: null
    })).toEqual(11);
  });
  it('should read default 12-hour value with am false', () => {
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: false,
      pm: null
    })).toEqual(12);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 1 },
      hourStr: null,
      hour12: null,
      am: false,
      pm: null
    })).toEqual(13);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 2 },
      hourStr: null,
      hour12: null,
      am: false,
      pm: null
    })).toEqual(14);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 3 },
      hourStr: null,
      hour12: null,
      am: false,
      pm: null
    })).toEqual(15);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 4 },
      hourStr: null,
      hour12: null,
      am: false,
      pm: null
    })).toEqual(16);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 5 },
      hourStr: null,
      hour12: null,
      am: false,
      pm: null
    })).toEqual(17);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 6 },
      hourStr: null,
      hour12: null,
      am: false,
      pm: null
    })).toEqual(18);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 7 },
      hourStr: null,
      hour12: null,
      am: false,
      pm: null
    })).toEqual(19);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 8 },
      hourStr: null,
      hour12: null,
      am: false,
      pm: null
    })).toEqual(20);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 9 },
      hourStr: null,
      hour12: null,
      am: false,
      pm: null
    })).toEqual(21);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 10 },
      hourStr: null,
      hour12: null,
      am: false,
      pm: null
    })).toEqual(22);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 11 },
      hourStr: null,
      hour12: null,
      am: false,
      pm: null
    })).toEqual(23);
  });
  it('should read default 12-hour value with pm false', () => {
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: false
    })).toEqual(0);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 1 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: false
    })).toEqual(1);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 2 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: false
    })).toEqual(2);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 3 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: false
    })).toEqual(3);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 4 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: false
    })).toEqual(4);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 5 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: false
    })).toEqual(5);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 6 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: false
    })).toEqual(6);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 7 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: false
    })).toEqual(7);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 8 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: false
    })).toEqual(8);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 9 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: false
    })).toEqual(9);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 10 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: false
    })).toEqual(10);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 11 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: false
    })).toEqual(11);
  });
  it('should read default 12-hour value with pm true', () => {
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: true
    })).toEqual(12);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 1 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: true
    })).toEqual(13);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 2 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: true
    })).toEqual(14);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 3 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: true
    })).toEqual(15);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 4 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: true
    })).toEqual(16);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 5 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: true
    })).toEqual(17);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 6 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: true
    })).toEqual(18);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 7 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: true
    })).toEqual(19);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 8 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: true
    })).toEqual(20);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 9 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: true
    })).toEqual(21);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 10 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: true
    })).toEqual(22);
    expect(processMixedHourParameters({
      settings: { ...settings, defaultAt12Hour: 11 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: true
    })).toEqual(23);
  });
  it('should read default 24-hour with default 12-hour value defined', () => {
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 0, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(0);
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 1, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(1);
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 2, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(2);
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 3, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(3);
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 4, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(4);
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 5, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(5);
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 6, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(6);
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 7, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(7);
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 8, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(8);
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 9, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(9);
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 10, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(10);
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 11, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(11);
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 12, defaultAt12Hour: 1 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(12);
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 13, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(13);
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 14, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(14);
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 15, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(15);
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 16, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(16);
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 17, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(17);
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 18, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(18);
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 19, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(19);
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 20, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(20);
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 21, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(21);
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 22, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(22);
    expect(processMixedHourParameters({
      settings: { defaultAtHour: 23, defaultAt12Hour: 12 },
      hourStr: null,
      hour12: null,
      am: null,
      pm: null
    })).toEqual(23);
  });
  it('should return null when nothing is defined', () => {
    expect(processMixedHourParameters({ settings, hourStr: null, hour12: null, am: null, pm: null })).toEqual(null);
  });
  it('should return error when using both hourStr and hour12 together', () => {
    expect(processMixedHourParameters({
      settings,
      hourStr: '10',
      hour12: 10,
      am: null,
      pm: null
    })).toEqual({ error: 'commands.at.responses.hourOrHour12Only' });
  });
  it('should return error when using hour12 without am or pm', () => {
    expect(processMixedHourParameters({
      settings,
      hourStr: null,
      hour12: 10,
      am: null,
      pm: null
    })).toEqual({ error: 'commands.at.responses.meridiemRequired' });
  });
  it('should return error when using am or pm together', () => {
    expect(processMixedHourParameters({
      settings,
      hourStr: null,
      hour12: null,
      am: true,
      pm: true
    })).toEqual({ error: 'commands.at.responses.amOrPmOnly' });
    expect(processMixedHourParameters({
      settings,
      hourStr: '10',
      hour12: null,
      am: true,
      pm: true
    })).toEqual({ error: 'commands.at.responses.amOrPmOnly' });
    expect(processMixedHourParameters({
      settings,
      hourStr: null,
      hour12: 10,
      am: true,
      pm: true
    })).toEqual({ error: 'commands.at.responses.amOrPmOnly' });
  });
  it('should return error when 24-hour value is out of range', () => {
    expect(processMixedHourParameters({
      settings,
      hourStr: '-1',
      hour12: null,
      am: null,
      pm: null
    })).toEqual({ error: 'commands.at.responses.hourRange' });
    expect(processMixedHourParameters({
      settings,
      hourStr: '24',
      hour12: null,
      am: null,
      pm: null
    })).toEqual({ error: 'commands.at.responses.hourRange' });
  });
  it('should return error when 12-hour value is out of range', () => {
    expect(processMixedHourParameters({
      settings,
      hourStr: '0am',
      hour12: null,
      am: null,
      pm: null
    })).toEqual({ error: 'commands.at.responses.hour12Range' });
    expect(processMixedHourParameters({
      settings,
      hourStr: '13am',
      hour12: null,
      am: null,
      pm: null
    })).toEqual({ error: 'commands.at.responses.hour12Range' });
    expect(processMixedHourParameters({
      settings,
      hourStr: '0pm',
      hour12: null,
      am: null,
      pm: null
    })).toEqual({ error: 'commands.at.responses.hour12Range' });
    expect(processMixedHourParameters({
      settings,
      hourStr: '13pm',
      hour12: null,
      am: null,
      pm: null
    })).toEqual({ error: 'commands.at.responses.hour12Range' });
    expect(processMixedHourParameters({
      settings,
      hourStr: '0',
      hour12: null,
      am: true,
      pm: null
    })).toEqual({ error: 'commands.at.responses.hour12Range' });
    expect(processMixedHourParameters({
      settings,
      hourStr: '13',
      hour12: null,
      am: true,
      pm: null
    })).toEqual({ error: 'commands.at.responses.hour12Range' });
    expect(processMixedHourParameters({
      settings,
      hourStr: '0',
      hour12: null,
      am: null,
      pm: true
    })).toEqual({ error: 'commands.at.responses.hour12Range' });
    expect(processMixedHourParameters({
      settings,
      hourStr: '13',
      hour12: null,
      am: null,
      pm: true
    })).toEqual({ error: 'commands.at.responses.hour12Range' });
  });
  it('should return error when hour with meridiem and meridiem parameters are used together', () => {
    expect(processMixedHourParameters({
      settings,
      hourStr: '1am',
      hour12: null,
      am: true,
      pm: null
    })).toEqual({ error: 'commands.at.responses.noAmOrPmWithMeridiem' });
    expect(processMixedHourParameters({
      settings,
      hourStr: '12am',
      hour12: null,
      am: true,
      pm: null
    })).toEqual({ error: 'commands.at.responses.noAmOrPmWithMeridiem' });
    expect(processMixedHourParameters({
      settings,
      hourStr: '1am',
      hour12: null,
      am: null,
      pm: true
    })).toEqual({ error: 'commands.at.responses.noAmOrPmWithMeridiem' });
    expect(processMixedHourParameters({
      settings,
      hourStr: '12am',
      hour12: null,
      am: null,
      pm: true
    })).toEqual({ error: 'commands.at.responses.noAmOrPmWithMeridiem' });
    expect(processMixedHourParameters({
      settings,
      hourStr: '1pm',
      hour12: null,
      am: null,
      pm: true
    })).toEqual({ error: 'commands.at.responses.noAmOrPmWithMeridiem' });
    expect(processMixedHourParameters({
      settings,
      hourStr: '12pm',
      hour12: null,
      am: null,
      pm: true
    })).toEqual({ error: 'commands.at.responses.noAmOrPmWithMeridiem' });
    expect(processMixedHourParameters({
      settings,
      hourStr: '1pm',
      hour12: null,
      am: true,
      pm: null
    })).toEqual({ error: 'commands.at.responses.noAmOrPmWithMeridiem' });
    expect(processMixedHourParameters({
      settings,
      hourStr: '12pm',
      hour12: null,
      am: true,
      pm: null
    })).toEqual({ error: 'commands.at.responses.noAmOrPmWithMeridiem' });
  });
  it('should return error with malformed hours input', () => {
    expect(processMixedHourParameters({
      settings,
      hourStr: 'am3',
      hour12: null,
      am: null,
      pm: null
    })).toEqual({ error: 'commands.at.responses.hourRange' });
    expect(processMixedHourParameters({
      settings,
      hourStr: 'am3',
      hour12: null,
      am: true,
      pm: null
    })).toEqual({ error: 'commands.at.responses.hour12Range' });
    expect(processMixedHourParameters({
      settings,
      hourStr: 'am3',
      hour12: null,
      am: null,
      pm: true
    })).toEqual({ error: 'commands.at.responses.hour12Range' });
  });
});
