import { ILogger, LogMethod } from '../types/logger-types.js';

export class Logger implements ILogger {
  protected prefixes: string[] = [];

  protected prefixString = '';

  protected mutedMethods = new Set<LogMethod>();

  constructor(prefix: string | string[], mutedMethods: LogMethod[] | Set<LogMethod> = []) {
    this.setPrefix(prefix);
    this.setMutedMethods(mutedMethods);
  }

  debug(...params: unknown[]): void {
    if (this.mutedMethods.has('debug')) return;
    console.debug(...this.addPrefixToLog(params));
  }

  info(...params: unknown[]): void {
    if (this.mutedMethods.has('info')) return;
    console.info(...this.addPrefixToLog(params));
  }

  log(...params: unknown[]): void {
    if (this.mutedMethods.has('log')) return;
    console.log(...this.addPrefixToLog(params));
  }

  warn(...params: unknown[]): void {
    if (this.mutedMethods.has('warn')) return;
    console.warn(...this.addPrefixToLog(params));
  }

  error(...params: unknown[]): void {
    if (this.mutedMethods.has('error')) return;
    console.error(...this.addPrefixToLog(params));
  }

  private setPrefix(rawPrefix: string | string[]) {
    const rawPrefixArray = Array.isArray(rawPrefix) ? rawPrefix : [rawPrefix];
    if (this.prefixes.length > 0) {
      const previousPrefix = this.prefixes;
      this.prefixes.splice(-1, 1, ...rawPrefixArray);
      this.info(`Prefix changed (previous: ${previousPrefix.join(',')})`);
    } else {
      this.prefixes = rawPrefixArray;
    }
    this.prefixString = `[${this.prefixes.join('][')}]`;
  }

  private setMutedMethods(mutedMethods: LogMethod[] | Set<LogMethod>): void {
    this.mutedMethods = Array.isArray(mutedMethods) ? new Set(mutedMethods) : mutedMethods;
  }

  protected static getPrefixForShardsValue(shards: string) {
    return `Shard#${shards}`;
  }

  static fromShardInfo(shards: string | string[] = '') {
    const shardsSuffix = Array.isArray(shards) ? shards.join(',') : shards;
    const prefix = this.getPrefixForShardsValue(shardsSuffix);
    return new Logger(prefix);
  }

  protected addPrefixToLog<T>(params: T[]): (T | string)[] {
    if (this.prefixes.length === 0) {
      return params;
    }
    if (typeof params[0] === 'string') {
      const [firstParam, ...restParams] = params;
      return [this.prefixString + ' ' + firstParam, ...restParams];
    }
    return [this.prefixString, ...params];
  }

  /**
   * Returns a new logger with the provided prefix(es) added to the existing prefix list
   */
  nest(nestedPrefix: string | string[]): Logger {
    const nestedPrefixArray = Array.isArray(nestedPrefix) ? nestedPrefix : [nestedPrefix];
    return new Logger([...this.prefixes, ...nestedPrefixArray], this.mutedMethods);
  }

  /**
   * Returns a new logger with only the provided methods muted
   *
   * @param mutedMethods
   */
  muteMethods(mutedMethods: LogMethod[]): Logger {
    return new Logger(this.prefixes, mutedMethods);
  }
}
