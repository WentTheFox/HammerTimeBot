import { NestableLogger } from '../types/logger-types.js';

export class DevNullLogger implements NestableLogger {
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

  nest(): NestableLogger {
    return new DevNullLogger();
  }
}
