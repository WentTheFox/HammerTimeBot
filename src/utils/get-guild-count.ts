import { REST } from '@discordjs/rest';
import { Routes, RESTGetAPICurrentUserGuildsResult } from 'discord-api-types/v10';
import { ILogger } from '../types/logger-types.js';

// client.guilds.cache.size has been broken (always 0) since the discord-bot-framework migration
// (see https://github.com/WentTheFox/HammerTimeBot/issues/178), and is never populated at all in
// webhook mode (no gateway connection to feed it) - GET /users/@me/guilds via REST works
// identically in both modes and doesn't depend on any gateway cache being warm. It's paginated at
// 200 guilds/page, so the result is cached briefly rather than re-fetched (and re-paginated) on
// every /statistics invocation.

const CACHE_TTL_MS = 5 * 60 * 1000;
// Whole-enumeration budget, not per-page: at ~6.4k guilds/200 per page that's ~32 sequential REST
// calls, so this needs enough headroom for a normal (if slow) full enumeration - @discordjs/rest has
// no timeout of its own, though, and happily awaits out a rate-limit backoff for as long as Discord
// says to wait, so without an upper bound one slow/rate-limited page anywhere in the loop can hang
// far longer than that (hit in practice: a single fetch took 77s - this bound exists for that case,
// not the normal one). A shared AbortSignal aborts mid-loop on overrun, which rejects the in-flight
// promise below and falls through to the existing stale-cache/null fallback.
const FETCH_TIMEOUT_MS = 8000;

let cachedCount: number | null = null;
let cachedAt = 0;
let inFlight: Promise<number> | null = null;

async function fetchGuildCount(rest: REST, logger: ILogger, signal: AbortSignal): Promise<number> {
  let total = 0;
  let after: string | undefined;
  for (;;) {
    const query = new URLSearchParams({ limit: '200' });
    if (after) query.set('after', after);
    const page = await rest.get(Routes.userGuilds(), { query, signal }) as RESTGetAPICurrentUserGuildsResult;
    total += page.length;
    if (page.length < 200) break;
    after = page[page.length - 1].id;
  }
  logger.debug(`Fetched guild count via REST: ${total}`);
  return total;
}

export async function getGuildCount(rest: REST, logger: ILogger): Promise<number> {
  if (cachedCount !== null && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedCount;
  }

  inFlight ??= fetchGuildCount(rest, logger, AbortSignal.timeout(FETCH_TIMEOUT_MS))
    .then((count) => {
      cachedCount = count;
      cachedAt = Date.now();
      return count;
    })
    .finally(() => {
      inFlight = null;
    });

  try {
    return await inFlight;
  } catch (e) {
    if (cachedCount !== null) {
      logger.error('Failed to refresh guild count, serving stale cached value', e);
      return cachedCount;
    }
    throw e;
  }
}
