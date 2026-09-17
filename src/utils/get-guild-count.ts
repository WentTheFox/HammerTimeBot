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

let cachedCount: number | null = null;
let cachedAt = 0;
let inFlight: Promise<number> | null = null;

async function fetchGuildCount(rest: REST, logger: ILogger): Promise<number> {
  let total = 0;
  let after: string | undefined;
  for (;;) {
    const query = new URLSearchParams({ limit: '200' });
    if (after) query.set('after', after);
    const page = await rest.get(Routes.userGuilds(), { query }) as RESTGetAPICurrentUserGuildsResult;
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
