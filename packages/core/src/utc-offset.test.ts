import { UtcOffset } from './utc-offset.js';
import { describe, expect, it } from 'vitest';

describe('UtcOffset', () => {
  describe('totalMinutes', () => {
    it('should work for simple hours input by default', () => {
      expect(new UtcOffset(1).totalMinutes).toEqual(60);
      expect(new UtcOffset(-1).totalMinutes).toEqual(-60);
      expect(new UtcOffset(10).totalMinutes).toEqual(600);
      expect(new UtcOffset(-10).totalMinutes).toEqual(-600);
      expect(new UtcOffset(69).totalMinutes).toEqual(4140);
      expect(new UtcOffset(-420).totalMinutes).toEqual(-25200);
    });
    it('should work for minute input', () => {
      expect(new UtcOffset(1, 0).totalMinutes).toEqual(60);
      expect(new UtcOffset(-1, 0).totalMinutes).toEqual(-60);
      expect(new UtcOffset(5, 5).totalMinutes).toEqual(305);
      expect(new UtcOffset(-5, 5).totalMinutes).toEqual(-305);
      expect(new UtcOffset(10, 59).totalMinutes).toEqual(659);
      expect(new UtcOffset(-10, 59).totalMinutes).toEqual(-659);
      expect(new UtcOffset(69, 30).totalMinutes).toEqual(4170);
      expect(new UtcOffset(-420, 42).totalMinutes).toEqual(-25242);
    });
  });
  describe('toString', () => {
    it('should work for simple hours input by default', () => {
      expect(new UtcOffset(1).toString()).toEqual('+01:00');
      expect(new UtcOffset(-1).toString()).toEqual('-01:00');
      expect(new UtcOffset(10).toString()).toEqual('+10:00');
      expect(new UtcOffset(-10).toString()).toEqual('-10:00');
      expect(new UtcOffset(69).toString()).toEqual('+69:00');
      expect(new UtcOffset(-420).toString()).toEqual('-420:00');
    });
    it('should work for minute input', () => {
      expect(new UtcOffset(1, 0).toString()).toEqual('+01:00');
      expect(new UtcOffset(-1, 0).toString()).toEqual('-01:00');
      expect(new UtcOffset(5, 5).toString()).toEqual('+05:05');
      expect(new UtcOffset(-5, 5).toString()).toEqual('-05:05');
      expect(new UtcOffset(10, 59).toString()).toEqual('+10:59');
      expect(new UtcOffset(-10, 59).toString()).toEqual('-10:59');
      expect(new UtcOffset(69, 30).toString()).toEqual('+69:30');
      expect(new UtcOffset(-420, 42).toString()).toEqual('-420:42');
    });
  });
});
