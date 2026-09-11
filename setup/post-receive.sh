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

# A full restart re-runs src/index.ts's startup command sync itself, and is required whenever
# index.ts (the ShardingManager process) or its dependency set may have changed, since respawning
# shards alone leaves the already-running manager process on its old in-memory code.
if echo "$CHANGED_FILES" | grep -qE "^(pnpm-lock\.yaml|package\.json|src/index\.ts)$"; then
  NEEDS_FULL_RESTART=1
else
  NEEDS_FULL_RESTART=0
fi

CURRENT_PID=$(pm2 pid HammerTimeBot 2>/dev/null)

if [ "$NEEDS_FULL_RESTART" = "1" ] || ! echo "$CURRENT_PID" | grep -qE "^[0-9]+$"; then
  echo "$ pm2 restart pm2.json"
  pm2 restart pm2.json
else
  echo "$ npm run sync-commands"
  npm run sync-commands
  echo "# Gracefully respawning shards on PID $CURRENT_PID via SIGUSR2"
  kill -SIGUSR2 "$CURRENT_PID"
fi
