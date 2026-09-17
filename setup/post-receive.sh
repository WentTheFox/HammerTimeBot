#!/usr/bin/env sh

read oldrev newrev refname
echo "Push triggered update to revision $newrev ($refname)"

GIT="env -i git"
CMD_PWD="cd .. && pwd"
CMD_FETCH="$GIT fetch"
CMD_NPM_INSTALL="pnpm install --frozen-lockfile"
CMD_NPM_BUILD="npm run build"

echo "$ $CMD_PWD"
eval $CMD_PWD
echo "$ $CMD_FETCH"
eval $CMD_FETCH

CHANGED_FILES=$($GIT diff --name-only $oldrev $newrev)

if echo "$CHANGED_FILES" | grep -q "^pnpm-lock.yaml"; then
  echo "$ $CMD_NPM_INSTALL"
  eval $CMD_NPM_INSTALL
else
  echo "# Skipping npm install, lockfile not modified"
fi

echo "$ $CMD_NPM_BUILD"
eval $CMD_NPM_BUILD

echo "$ npm run sync-commands"
npm run sync-commands

# The webhook process (src/webhook.ts) has no shards/gateway connection to gracefully drain - it's
# a single stateless process, so a plain restart on every deploy is cheap and always safe, unlike
# the old gateway process's graceful SIGUSR2 shard-respawn dance this replaced.
echo "$ pm2 restart pm2.json"
pm2 restart pm2.json
