import type { Backend, KeyContext } from './backend.js';
import type { ErrorBody } from './schemas.js';

export interface ResolvedKey extends KeyContext {
  /** Always set: a service key has to name the account it acts for */
  discordUserId: string;
}

export type Authentication =
  | { ok: true; key: ResolvedKey }
  | { ok: false; status: 400 | 401 | 403; body: ErrorBody; headers?: Record<string, string> };

const SNOWFLAKE_REGEX = /^\d{15,25}$/;

export const errorBody = (code: string, message: string): ErrorBody => ({ error: { code, message } });

/**
 * Resolves the API key of a request, for the REST endpoints and the MCP endpoint alike: the bearer key, and for the
 * bot's service key the Discord account it acts on behalf of
 */
export const authenticate = async (
  backend: Backend,
  headers: Headers,
  { allowServiceKeys = true }: { allowServiceKeys?: boolean } = {},
): Promise<Authentication> => {
  const token = headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
  const key = token ? await backend.validateKey(token) : null;
  if (!key) {
    return { ok: false, status: 401, body: errorBody('unauthorized', 'A valid API key is required'), headers: { 'WWW-Authenticate': 'Bearer' } };
  }

  let discordUserId = key.discordUserId;
  if (key.kind === 'service') {
    if (!allowServiceKeys) {
      return { ok: false, status: 403, body: errorBody('forbidden', 'The service key can not be used here') };
    }
    const header = headers.get('X-Discord-User-Id');
    if (!header || !SNOWFLAKE_REGEX.test(header)) {
      return { ok: false, status: 400, body: errorBody('invalid_request', 'Service keys must name the Discord account in the X-Discord-User-Id header') };
    }
    discordUserId = header;
  }
  if (!discordUserId) {
    return { ok: false, status: 401, body: errorBody('unauthorized', 'The API key is not linked to a Discord account') };
  }

  return { ok: true, key: { ...key, discordUserId } };
};
