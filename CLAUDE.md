# HammerTimeBot

A pnpm workspace: the Discord bot at the root, `packages/core` (shared logic, `@went.tf/hammertime-core`, not published to npm)
and `packages/api` (the public REST API and the MCP server, `@went.tf/hammertime-api`). Laravel (SledgeHammerTime) is the system of
record, the API server never talks to the database itself.

- Checks: `pnpm run lint`, `pnpm test` (the bot), `pnpm run test:packages` (core and api). CI runs all of them and a build.
  The API's tests of the Redis limiter run against a real Redis when `TEST_REDIS_URL` is set (CI has one, `redis://127.0.0.1:6379/15`)
  and are skipped without it.
- The API's generated files are committed and kept in sync by tests: `pnpm --filter @went.tf/hammertime-api run generate`
  (from `src/commands.json`) and `... run openapi:sync` (`docs/openapi/api-docs.json`). Add `-- --check` to only compare.
- Production runs the container image (see below) on the Rathalos cluster, managed by Argo CD (Application `hammertimebot-prod`, automatic
  sync, two copies of the webhook and of the API). There is no `git push deploy` any more and the `vinyl`/`hammertime.vps` toolkit is
  gone. Every push to `main` builds the image, Image Updater pins the new sha image and Argo CD deploys it by itself, so **a push to
  `main` is a production deploy**: do not push to `main` without the user's go-ahead. The **Deploy** workflow
  (`.github/workflows/deploy.yml`, `workflow_dispatch` only) is just a manual "sync now" button: it makes GitHub send a signed
  `workflow_run` webhook to the cluster's receiver, which asks Argo CD to sync `hammertimebot-prod`. Cluster config (e.g. `API_URL` in the webhook ConfigMap)
  lives in the Rathalos repository, not here. The command sync (`sync-commands`) runs as an Argo PostSync Job and keeps its state at
  `COMMAND_SYNC_STATE_PATH`. The API reads `packages/api/.env` (`packages/api/.env.example`) when run outside the cluster.
- Several copies of a process can run at once and are replaced one at a time, so a process must not keep anything in memory that a
  request needs from the one before (the API's key cache is per worker on purpose, and its rate limits are counted in Redis when
  `REDIS_URL` or `REDIS_HOST` is set, see `packages/api/README.md`), and has to call `announceReady()` once listening and stop through
  `shutdownGracefully()` (`graceful-shutdown.ts`, one copy in `src/utils` and one in `packages/api/src`, change both).
- Legacy: `pm2.json`, `deploy.conf` and `deploy/` are from the pm2 era (two-worker clusters reloaded with `wait_ready`, `PM2_DEPLOY_TIMEOUT`,
  `deploy_pm2_app`) and are not how production is deployed now. If you change how a process starts, note that pm2 started workers from a
  directory of its own, so nothing a process needs may be a path relative to the working directory (the API reads `packages/api/.env`
  by the location of the package, `load-env-file.ts`).

## Commits and the container image

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`, with `type` one of
  `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert` (`!` before the colon for a breaking
  change). Scopes in use are e.g. `api` and `deploy`. History is not rewritten.
- The types are for readability and the changelog only, they do not drive any versioning. `.github/workflows/docker.yml` publishes
  `ghcr.io/wentthefox/hammertimebot` (linux/amd64 and linux/arm64, from `Dockerfile`: one image, two commands) on every push to
  `main`, tagged `sha-<7 hex>` and `sha-<40 hex>` only: the commit is the version. No version tags, no `latest`, no `v*` git
  tags. `mcp-v*` tags are the MCP registry's, not this.
- The build stage needs `python3 make g++` because `bufferutil` and `utf-8-validate` have no prebuilt arm64 binary. Keep secrets out
  of the image, see `.dockerignore`.

## Releasing the MCP server to the MCP Registry

`packages/api/server.json` is what [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io/) lists as
`io.github.WentTheFox/hammertime`: the endpoint `https://api.hammertime.cyou/mcp` and that it wants the API key as a bearer token.
The registry only stores metadata, there is no package to publish. `.github/workflows/publish-mcp.yml` publishes it with the OIDC
token of GitHub Actions, so no secret is stored anywhere.

A release is a version bump and a tag. Do it from **this repository**, `git tag` in another checkout tags that one.

1. Raise the version in **both** `packages/api/package.json` and `packages/api/server.json`, to the same value. A test
   (`src/server-json.test.ts`) fails when they differ or when it is not a plain `major.minor.patch`.
2. If the major or minor part changed, also run `pnpm --filter @went.tf/hammertime-api run openapi:sync` and commit the
   result. `API_VERSION` (`packages/api/src/version.ts`) is the major.minor of the package version, it is the `info.version` of the
   OpenAPI document and the version the MCP server reports, and `sync.test.ts` fails on a stale copy. Such a change needs a
   normal `git push deploy` for the running server to report it. A patch bump changes neither and needs no deploy.
3. Merge to `main`, then tag and push that commit: `git tag mcp-v<version> && git push origin mcp-v<version>`.
   The tag has to be `mcp-v` plus the version in `server.json`, the workflow refuses anything else.
4. Check the run: it tests the packages, compares the tag, runs `mcp-publisher validate`, logs in and publishes. Afterwards the
   version shows up in `https://registry.modelcontextprotocol.io/v0.1/servers?search=hammertime`.

Things that are easy to get wrong:

- **A version can be published once.** Fixing a typo in the title or description of a listing is a new version too. A failed run
  that got as far as publishing can not simply be re-run, bump the version.
- **The name is permanent**, and has to start with `io.github.WentTheFox/` because that is what the OIDC login proves. Moving to a
  domain name such as `cyou.hammertime/...` would be a different listing, with DNS or HTTP authentication and a stored private key.
- Only changes to the endpoint, the header or the description need a new registry version. The tools of the server are not listed
  in it, they come from the running server, so adding a command needs no release.
- `mcp-publisher` is pinned in the workflow together with the SHA-256 of its archive. To update it, take the new version and the
  checksum of `mcp-publisher_linux_amd64.tar.gz` from the release's `registry_<version>_checksums.txt`.
- `mcp-publisher validate` in `packages/api` checks `server.json` against the registry without logging in or publishing.
