import { SnowflakeError } from './snowflake-error.js';

const DISCORD_EPOCH = 1420070400000;
const SNOWFLAKE_MIN_VALUE = 4194304;

const validateSnowflake = (snowflake: string): bigint | null => {
  if (snowflake.length > 0) {
    try {
      const snowflakeNumber = BigInt(snowflake.trim());
      if (snowflakeNumber >= SNOWFLAKE_MIN_VALUE) {
        return snowflakeNumber;
      }
    } catch (e) {
      if (!(e instanceof Error) || !/^Cannot convert .* to a BigInt$/.test(e.message)) {
        throw e;
      }
    }
  }

  return null;
};

/**
 * Converts a snowflake to a unix timestamp
 * @param snowflake The snowflake to convert
 * @returns UNIX timestamp in seconds
 * @throws {Error} If the snowflake is invalid
 */
export default function snowflakeToUnix(snowflake: string): number {
  const snowflakeNumber = validateSnowflake(snowflake);
  if (snowflakeNumber === null) {
    throw new SnowflakeError(snowflake);
  }

  return Math.floor(((Number(snowflakeNumber >> 22n)) + DISCORD_EPOCH) / 1000);
}
