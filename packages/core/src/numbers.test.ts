import { pad, PadDirection } from './numbers.js';
import { describe, expect, it } from 'vitest';

describe('pad', () => {
  it('should pad from the left by default', () => {
    expect(pad(0, 2)).toEqual('00');
    expect(pad(5, 2)).toEqual('05');
    expect(pad(9, 2)).toEqual('09');
    expect(pad(100, 2)).toEqual('100');
    expect(pad(100, 4)).toEqual('0100');
    expect(pad(100, 5)).toEqual('00100');
  });
  it('should be able to pad from the right', () => {
    expect(pad(0, 2, PadDirection.RIGHT)).toEqual('00');
    expect(pad(5, 2, PadDirection.RIGHT)).toEqual('50');
    expect(pad(9, 2, PadDirection.RIGHT)).toEqual('90');
    expect(pad(100, 2, PadDirection.RIGHT)).toEqual('100');
    expect(pad(100, 4, PadDirection.RIGHT)).toEqual('1000');
    expect(pad(100, 5, PadDirection.RIGHT)).toEqual('10000');
  });
  it('should handle negative numbers', () => {
    expect(pad(-0, 2)).toEqual('00');
    expect(pad(-1, 2)).toEqual('-01');
    expect(pad(-5, 2)).toEqual('-05');
    expect(pad(-9, 2)).toEqual('-09');
    expect(pad(-100, 2)).toEqual('-100');
    expect(pad(-100, 4)).toEqual('-0100');
    expect(pad(-100, 5)).toEqual('-00100');
    expect(pad(0, 2, PadDirection.RIGHT)).toEqual('00');
    expect(pad(-1, 2, PadDirection.RIGHT)).toEqual('-10');
    expect(pad(-5, 2, PadDirection.RIGHT)).toEqual('-50');
    expect(pad(-9, 2, PadDirection.RIGHT)).toEqual('-90');
    expect(pad(-100, 2, PadDirection.RIGHT)).toEqual('-100');
    expect(pad(-100, 4, PadDirection.RIGHT)).toEqual('-1000');
    expect(pad(-100, 5, PadDirection.RIGHT)).toEqual('-10000');
  });
});
