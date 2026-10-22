import snowflakeToUnix from './snowflake.js';
import { SnowflakeError } from './snowflake-error.js';
import { describe, expect, it } from 'vitest';

describe('snowflakeToUnix', () => {
  it('should convert a snowflake to a unix timestamp', () => {
    expect(snowflakeToUnix('996673713938366504')).toEqual(1657695930);
    expect(snowflakeToUnix('1005505184094507048')).toEqual(1659801517);
    expect(snowflakeToUnix('1006946901482029096')).toEqual(1660145249);
    expect(snowflakeToUnix('1052750665581088768')).toEqual(1671065717);
    expect(snowflakeToUnix('140360880079503362')).toEqual(1453535041);
    expect(snowflakeToUnix('138353487208644608')).toEqual(1453056441);
    expect(snowflakeToUnix('0x1EB87C37A81FFF8')).toEqual(1453056441);
    expect(snowflakeToUnix('4194304')).toEqual(1420070400);
  });
  it('should throw an error if the snowflake is not a number', () => {
    const invalidInput = ['invalid', '', '120312039NotANumber012021', 'one'];
    invalidInput.forEach(input => {
      expect(() => snowflakeToUnix(input)).toThrow(new SnowflakeError(input));
    });
  });
  it('should throw an error if the snowflake is too small', () => {
    const invalidInput = ['4194303', '0', '-10', '-138353487208644608'];
    invalidInput.forEach(input => {
      expect(() => snowflakeToUnix(input)).toThrow(new SnowflakeError(input));
    });
  });
});
