import { IValidation } from 'typia';
import { ApiAuthType, ApiClient, ApiHttpException, RetryOptions } from '@went.tf/discord-bot-framework/api-client';
import { env } from '../env.js';
import { LoggerContext } from '../types/bot-interaction.js';
import { ILogger, LogMethod } from '../types/logger-types.js';
import { routeFromApiPath, withBackendRequestSpan } from './tracing.js';

export interface BackendApiRequest<T> {
  path: string;
  method?: string;
  body?: unknown;
  validator: (data: unknown) => IValidation<T>;
  /**
   * Throw an error if the response does not pass validation
   * @default true
   */
  failOnInvalidResponse?: boolean;
  /**
   * Retries (with exponential backoff) on 5xx/429 - see ApiClient's RetryOptions. Off by default;
   * most callers here run inline with a user-facing interaction and shouldn't sit through retries.
   * The retry loop lives in this helper (ApiClient is always used with a single attempt) so that the
   * warnings/errors of attempts that are about to be retried can be held back - see createDeferredLogger.
   */
  retry?: RetryOptions;
  /**
   * Aborts the request after this many milliseconds (per attempt, if combined with `retry`) - see
   * ApiRequest.timeoutMs in discord-bot-framework/api-client (native support as of 2.9.0). Off by
   * default; only worth setting where the caller already has a fallback for failure and a real
   * deadline (e.g. getSettings inside Discord's 3s interaction-response budget) - a bare fetch
   * failure and a timeout both just throw, so this doesn't change error handling, only how long a
   * hung request is allowed to block it.
   */
  timeoutMs?: number;
}

export interface BackendApiResponse<T> {
  responseText: string | undefined;
  response: T;
  validation: IValidation<T>;
  ok: boolean;
  status: number;
  /** True when read-only mode (READ_ONLY) kept the request from being sent at all */
  skipped?: boolean;
}

// Same rule as ApiClient's own default: HTTP failures retry on 5xx/429, anything else (network errors,
// timeouts - ApiClient reports both as a 500) retries unconditionally.
const defaultShouldRetry = (error: unknown): boolean => {
  if (error instanceof ApiHttpException) {
    return error.status >= 500 || error.status === 429;
  }
  return true;
};

/**
 * ApiClient logs an error for every failed attempt, which is noise when the next attempt is going to
 * succeed (a 504 while the backend is briefly stalled, say). This holds back warn/error until the
 * caller knows the request is final (`flush`), and passes everything else straight through.
 */
const createDeferredLogger = (logger: ILogger) => {
  const held: Array<[LogMethod, unknown[]]> = [];
  const hold = (method: LogMethod) => (...params: unknown[]) => {
    held.push([method, params]);
  };
  const deferred: ILogger = {
    debug: (...params) => logger.debug(...params),
    info: (...params) => logger.info(...params),
    log: (...params) => logger.log(...params),
    warn: hold('warn'),
    error: hold('error'),
    nest: (prefix) => logger.nest(prefix),
    muteMethods: (methods) => logger.muteMethods(methods),
  };
  return {
    logger: deferred,
    flush: () => held.forEach(([method, params]) => logger[method](...params)),
  };
};

/** Whether the request is a write that read-only mode (the READ_ONLY env var) keeps from being sent */
export const isBlockedByReadOnly = (method?: string): boolean =>
  env.READ_ONLY && !['GET', 'HEAD'].includes((method ?? 'GET').toUpperCase());

/** Origin the backend API is called on: BACKEND_API_URL when set, else the public API_URL. */
const backendOrigin = (): string => (env.BACKEND_API_URL || env.API_URL).replace(/\/+$/, '');

/** Host of the backend API for span attributes; never throws. */
const apiHost = (): string | undefined => {
  try {
    return new URL(backendOrigin()).host;
  } catch {
    return undefined;
  }
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const backendApiRequest = async <T>(
  { logger }: LoggerContext,
  params: BackendApiRequest<T>,
): Promise<BackendApiResponse<T>> => {
  if (isBlockedByReadOnly(params.method)) {
    logger.log(`Read-only mode, skipped ${params.method} ${params.path}`);
    return {
      responseText: undefined,
      response: undefined as T,
      validation: { success: false, errors: [] } as unknown as IValidation<T>,
      ok: false,
      status: 503,
      skipped: true,
    };
  }

  const { maxAttempts = 1, initialDelayMs = 500, shouldRetry = defaultShouldRetry } = params.retry ?? {};

  for (let attempt = 0; ; attempt++) {
    const attemptLogger = createDeferredLogger(logger);
    try {
      const result = await withBackendRequestSpan(
        { method: (params.method ?? 'GET').toUpperCase(), route: routeFromApiPath(params.path), host: apiHost(), timeoutMs: params.timeoutMs, attempt: attempt + 1 },
        async ({ headers, setStatus }) => {
          const apiClient = new ApiClient(attemptLogger.logger, {
            baseUrl: `${backendOrigin()}/api`,
            authentication: { type: ApiAuthType.AUTHORIZATION_HEADER, getValue: () => env.API_TOKEN },
            fixedHeaders: headers,
          });
          const response = await apiClient.request<T>({
            path: params.path,
            method: params.method,
            body: params.body,
            validator: params.validator,
            failOnInvalidResponse: params.failOnInvalidResponse,
            timeoutMs: params.timeoutMs,
          });
          setStatus(response.status);
          return response;
        },
      );
      attemptLogger.flush();
      if (attempt > 0) {
        logger.info(`Request to ${params.path} succeeded on attempt ${attempt + 1}/${maxAttempts}`);
      }
      return {
        responseText: result.responseText,
        response: result.response,
        validation: result.validation as IValidation<T>,
        ok: result.ok,
        status: result.status,
      };
    } catch (e) {
      if (attempt < maxAttempts - 1 && shouldRetry(e)) {
        const delay = initialDelayMs * 2 ** attempt;
        // Only debug: the attempt's own warn/error stay held back and are dropped, since another attempt is coming.
        // If every attempt fails, the last one is logged in full below.
        logger.debug(`Request to ${params.path} failed (attempt ${attempt + 1}/${maxAttempts}), retrying in ${delay}ms…`, e);
        await wait(delay);
        continue;
      }

      attemptLogger.flush();
      if (e instanceof ApiHttpException) {
        return {
          responseText: undefined,
          response: undefined as T,
          validation: { success: false, errors: [] } as unknown as IValidation<T>,
          ok: false,
          status: e.status,
        };
      }
      throw e;
    }
  }
};
