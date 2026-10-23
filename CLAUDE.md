# HammerTimeBot

A pnpm workspace: the Discord bot at the root, `packages/core` (shared logic, `@went.tf/hammertime-core`, not published to npm)
and `packages/api` (the public REST API and the MCP server, `@went.tf/hammertime-api`). Laravel (SledgeHammerTime) is the system of
record, the API server never talks to the database itself.

- Checks: `pnpm run lint`, `pnpm test` (the bot), `pnpm run test:packages` (core and api). CI runs all of them and a build.
- The API's generated files are committed and kept in sync by tests: `pnpm --filter @went.tf/hammertime-api run generate`
  (from `src/commands.json`) and `... run openapi:sync` (`docs/openapi/api-docs.json`). Add `-- --check` to only compare.
- Deploys are `git push deploy`, which restarts both pm2 apps (`HammerTimeBot:Webhook` and `HammerTimeBot:Api`). The API reads
  `packages/api/.env`, see `packages/api/.env.example`.

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
