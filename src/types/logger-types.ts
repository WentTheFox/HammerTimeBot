export type LogMethod =
  | 'debug'
  | 'info'
  | 'log'
  | 'warn'
  | 'error';

export type ILogger = Record<LogMethod, (...params: unknown[]) => void> & {
  nest(nestedPrefix: string | string[]): ILogger;

  muteMethods(mutedMethods: LogMethod[]): ILogger;
}
