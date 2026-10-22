import { authenticate, errorBody, ResolvedKey } from './auth.js';
import type { Backend } from './backend.js';
import { rateLimitHeaders, RateLimits } from './rate-limit.js';
import type { ErrorBody } from './schemas.js';

export type GuardOutcome =
  | { ok: true; key: ResolvedKey; headers: Record<string, string> }
  | { ok: false; status: 400 | 401 | 403 | 429; body: ErrorBody; headers?: Record<string, string> };

export interface GuardOptions {
  backend: Backend;
  limits: RateLimits;
  request: Request;
  /** The address of the connection, when the server knows it */
  socketAddress: string | undefined;
  allowServiceKeys?: boolean;
}

const tooMany = (message: string, headers: Record<string, string>): GuardOutcome => ({
  ok: false,
  status: 429,
  body: errorBody('rate_limited', message),
  headers,
});

/**
 * Lets a request through to an endpoint, for the REST endpoints and the MCP endpoint alike:
 *
 * 1. A client address that has failed to authenticate too often is turned away before anything else is looked up, so a
 *    flood of made-up keys does not each cost the Laravel app a lookup.
 * 2. The API key is resolved.
 * 3. A failed authentication counts against the client address.
 * 4. A key is limited per key, and the bot's service key per Discord account it acts for, so a single noisy user
 *    can not use up what everybody else gets.
 */
export const guard = async ({ backend, limits, request, socketAddress, allowServiceKeys }: GuardOptions): Promise<GuardOutcome> => {
  const ip = limits.clientIp(request, socketAddress);

  const lockout = limits.authFailures.peek(ip);
  if (!lockout.allowed) {
    // Only when to come back: the RateLimit headers describe the quota of a key, not this counter of failures
    return tooMany('Too many failed attempts to authenticate, try again later', { 'Retry-After': String(Math.max(1, lockout.retryAfterSeconds)) });
  }

  const authentication = await authenticate(backend, request.headers, { allowServiceKeys });
  if (!authentication.ok) {
    if (authentication.status === 401) {
      limits.authFailures.consume(ip);
    }
    return authentication;
  }

  const { key } = authentication;
  const result = limits.requests.consume(key.kind === 'service' ? `account:${key.discordUserId}` : `key:${key.keyId}`);
  const headers = rateLimitHeaders(result);
  if (!result.allowed) {
    return tooMany('Too many requests, slow down', headers);
  }

  return { ok: true, key, headers };
};
