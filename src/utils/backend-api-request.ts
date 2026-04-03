import { env } from '../env.js';
import { IValidation } from 'typia';
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
  let responseText: string | undefined;
  let r: Response | undefined;
  const requestUrl = `${env.API_URL}/api${params.path}`;

  const { failOnInvalidResponse = true } = params;

  try {
    r = await fetch(requestUrl, {
      method: params.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${env.API_TOKEN}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: typeof params.body !== 'undefined' ? JSON.stringify(params.body) : undefined,
    });

    responseText = await r.text();
    if (!r.ok) {
      throw new Error(`fetch ${requestUrl}: ${r.status} ${r.statusText}\n${responseText}`);
    }
  } catch (e) {
    logger.error('Failed API request:', e);
  }

  const response = responseText && r?.headers.get('content-type') === 'application/json' ? JSON.parse(responseText) : responseText;
  const validation = params.validator(response);
  if (!validation.success) {
    const errorMessage = `fetch ${requestUrl}: Validation failed\n${responseText}\n${['', ...validation.errors.map(err => JSON.stringify(err))].join('\n- ')}`;
    if (failOnInvalidResponse) {
      throw new Error(errorMessage);
    }
    logger.warn(errorMessage);
  }

  return { responseText, response, validation, ok: r?.ok ?? false, status: r?.status ?? NaN };
};
