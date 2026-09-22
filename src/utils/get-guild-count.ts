import { REST } from '@discordjs/rest';
import { Routes, RESTGetCurrentApplicationResult } from 'discord-api-types/v10';
import { ILogger } from '../types/logger-types.js';

// client.guilds.cache.size has been broken (always 0) since the discord-bot-framework migration
// (see https://github.com/WentTheFox/HammerTimeBot/issues/178), and is never populated at all in
// webhook mode (no gateway connection to feed it). GET /applications/@me's approximate_guild_count
// is a single request, unlike paginating GET /users/@me/guilds - at ~6.4k guilds that was ~32
// rate-limited sequential calls, which in practice never finished within its timeout. The result is
// still cached briefly so /statistics doesn't hit the API on every invocation.

const CACHE_TTL_MS = 5 * 60 * 1000;
// @discordjs/rest has no timeout of its own, and happily awaits out a rate-limit backoff for as long
// as Discord says to wait, so bound it - a rejection here falls through to the stale-cache/null
// fallback below.
const FETCH_TIMEOUT_MS = 5000;

let cachedCount: number | null = null;
let cachedAt = 0;
let inFlight: Promise<number> | null = null;

async function fetchGuildCount(rest: REST, logger: ILogger): Promise<number> {
  const application = await rest.get(Routes.currentApplication(), {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  }) as RESTGetCurrentApplicationResult;
  if (typeof application.approximate_guild_count !== 'number') {
    throw new Error('Current application response is missing approximate_guild_count');
  }
  logger.debug(`Fetched guild count via REST: ${application.approximate_guild_count}`);
  return application.approximate_guild_count;
}

export async function getGuildCount(rest: REST, logger: ILogger): Promise<number> {
  if (cachedCount !== null && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedCount;
  }

  inFlight ??= fetchGuildCount(rest, logger)
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
