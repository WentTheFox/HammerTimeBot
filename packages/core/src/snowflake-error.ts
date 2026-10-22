export class SnowflakeError extends Error {
  constructor(input: string) {
    super(`Invalid snowflake "${input}"`);
  }
}
