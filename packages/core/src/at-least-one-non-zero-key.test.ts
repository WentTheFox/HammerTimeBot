import { atLeastOneNonZeroKey } from './at-least-one-non-zero-key.js';
import { describe, expect, it } from 'vitest';

describe('atLeastOneNonzeroKey', () => {
  it('should return true when all keys have a nonzero value', () => {
    expect(atLeastOneNonZeroKey({ a: 1 })).toEqual(true);
    expect(atLeastOneNonZeroKey({ a: 2, b: 1 })).toEqual(true);
  });

  it('should return true when some keys have non-numeric values', () => {
    expect(atLeastOneNonZeroKey({ a: 1, b: null })).toEqual(true);
  });

  it('should return false when all keys have a zero value', () => {
    expect(atLeastOneNonZeroKey({ a: 0 })).toEqual(false);
    expect(atLeastOneNonZeroKey({ a: 0, b: 0 })).toEqual(false);
  });

  it('should return false when all keys have non-numeric values', () => {
    expect(atLeastOneNonZeroKey({ a: undefined })).toEqual(false);
    expect(atLeastOneNonZeroKey({ a: undefined, b: null })).toEqual(false);
  });
});
