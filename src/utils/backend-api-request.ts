import { IValidation } from 'typia';
import { ApiAuthType, ApiClient, ApiHttpException, RetryOptions } from '@went.tf/discord-bot-framework/api-client';
import { env } from '../env.js';
import { LoggerContext } from '../types/bot-interaction.js';

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
}

export const backendApiRequest = async <T>(
  { logger }: LoggerContext,
  params: BackendApiRequest<T>,
): Promise<BackendApiResponse<T>> => {
  const apiClient = new ApiClient(logger, {
    baseUrl: `${env.API_URL}/api`,
    authentication: { type: ApiAuthType.AUTHORIZATION_HEADER, getValue: () => env.API_TOKEN },
    retry: params.retry,
  });

  try {
    const result = await apiClient.request<T>({
      path: params.path,
      method: params.method,
      body: params.body,
      validator: params.validator,
      failOnInvalidResponse: params.failOnInvalidResponse,
      timeoutMs: params.timeoutMs,
    });
    return {
      responseText: result.responseText,
      response: result.response,
      validation: result.validation as IValidation<T>,
      ok: result.ok,
      status: result.status,
    };
  } catch (e) {
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
};
