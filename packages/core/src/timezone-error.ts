export class TimezoneError extends Error {
  constructor(timezone: string) {
    super(`Cannot resolve timezone ${timezone}`);
  }
}
