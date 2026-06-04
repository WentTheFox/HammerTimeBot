import { ILogger } from '../types/logger-types.js';

export class DevNullLogger implements ILogger {
  debug(): void {
  }

  info(): void {
  }

  log(): void {
  }

  warn(): void {
  }

  error(): void {
  }

  nest(): ILogger {
    return new DevNullLogger();
  }

  muteMethods(): this {
    return this;
  }
}
