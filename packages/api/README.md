# HammerTime API

The public REST API and the MCP server of HammerTime. Every endpoint, and every MCP tool, is the bot command of the same
name, and every input is the command's option with the same name, so `POST /at` takes `year`, `month`, `day`, `hour`,
`minute`, `timezone`, `format` and so on, resolved against the saved settings of the account exactly as the bot does it.
The logic is `@went.tf/hammertime-core`, which the bot uses too.

| | |
| --- | --- |
| `POST /at`, `/at12`, `/iso`, `/unix`, `/in`, `/ago`, `/add`, `/subtract`, `/snowflake` | The commands, scope `timestamps:create` |
| `GET`/`PATCH /settings` | The bot settings of the account, scopes `settings:read` / `settings:write` |
| `GET /me`, `GET /health` | The key in use, and the service status |
| `POST /mcp` | The MCP server (Streamable HTTP, stateless), the same API keys |
| `GET /` and `GET /generated/api-docs.json` | Swagger UI and the OpenAPI document |

Usage is recorded as the bot's is (same counters, with the source `api` or `mcp`) unless the account turned telemetry
off, and the replies carry the run count the way the bot's do.

## Keys

Users create them on the HammerTime website (profile page), each acts as one linked Discord account. Send one as
`Authorization: Bearer htk_...`. The bot has a service key of its own that names the account per request in
`X-Discord-User-Id`; it is accepted by the REST endpoints for the commands only, not by `/mcp`.

An MCP client is configured with the URL of `/mcp` and the header, for example:

```json
{ "mcpServers": { "hammertime": { "type": "http", "url": "https://<host>/mcp", "headers": { "Authorization": "Bearer htk_..." } } } }
```

## The bot as a client

The bot can ask this API to handle its timestamp commands (`COMMANDS_API_URL` and `COMMANDS_API_KEY` in the bot's `.env`, see
`.env.example`). It sends the options the user gave, as the service key with `X-Discord-User-Id`, and turns the answer into the
Discord reply. The API has recorded the run by then and the reply carries the note about it, so the bot does not record it a
second time. When the API is down, slow (`COMMANDS_API_TIMEOUT_MS`), refuses the bot or limits it, the bot handles the
command itself exactly as it did before, including recording the run, so an outage of this service costs nothing but
the logged warning. Input the API rejects is worded by the bot and recorded as it always was.

## Rate limits

Each key may make `RATE_LIMIT_PER_MINUTE` requests (60) on average, with a burst of half of that, across the REST endpoints
and `/mcp` together. The bot's service key is limited per Discord account it acts for, so one noisy user cannot use up what
the others get. Every response of an authenticated request carries `RateLimit-Limit`, `RateLimit-Remaining` and
`RateLimit-Reset`, and a refused one is a `429` with `Retry-After` (seconds). `/health` and the documentation are not limited.

A client address that fails to authenticate `AUTH_FAILURES_PER_MINUTE` times (20) is turned away with a `429` until it has waited,
before anything is looked up, so a flood of made-up keys does not each cost the Laravel app a lookup. Even a good key from that
address waits, which can catch innocent users behind a shared address, so keep the number generous.

Behind a reverse proxy every client has the proxy's address, so they would all count as one. Set `CLIENT_IP_HEADER` to a header
the proxy sets to the client's address **and overwrites** (nginx: `proxy_set_header X-Real-IP $remote_addr;`), otherwise anyone
could pick the address they are counted under. The limits are kept in memory, per process, and nothing runs in the background.

## Where the data lives

Nothing is stored here. The Laravel app (SledgeHammerTime) owns keys, settings and telemetry, and this service talks to its
`/internal` endpoints with `INTERNAL_API_SECRET` (see `docs/api.md` in that repository). Validated keys are remembered for
`KEY_CACHE_TTL_SECONDS`, so a revoked key keeps working for that long.

## Generated parts

`src/generated/commands.ts` (the request schemas, option types and English texts) is generated from the bot's
`src/commands.json` and its `en-US` locale, and `docs/openapi/api-docs.json` (in the repository root) from the routes.
Both are committed, and the tests fail when they are stale:

```sh
pnpm --filter @went.tf/hammertime-api run generate                       # after changing commands.json or the locale
pnpm --filter @went.tf/hammertime-api run generate -- --commands <path>  # from another commands file
pnpm --filter @went.tf/hammertime-api run generate -- --check            # write nothing, fail when out of date
pnpm --filter @went.tf/hammertime-api run openapi:sync [-- --check]      # after changing routes or their descriptions
```

## Running it

```sh
pnpm run build:core && pnpm --filter @went.tf/hammertime-api run build
cp packages/api/.env.example .env.api    # fill it in
node --env-file=.env.api packages/api/dist/src/server.js
```

On the server pm2 runs it (`HammerTimeBot:Api` in `pm2.json`), but only when `.env.api` exists, see `deploy.conf`. Deploy the
Laravel app first, since this service calls its internal endpoints. A reverse proxy has to put it on a hostname, it
listens on `127.0.0.1:3010`.

## Tests

`pnpm run test:packages` from the root (core and API). They run the app in-process against an in-memory backend, the MCP
tests use the real MCP SDK client.
