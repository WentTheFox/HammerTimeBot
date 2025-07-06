#!/usr/bin/env sh

read oldrev newrev refname
echo "Push triggered update to revision $newrev ($refname)"

GIT="env -i git"
CMD_PWD="cd .. && pwd"
CMD_FETCH="$GIT fetch"
CMD_NPM_INSTALL="npm ci"
CMD_NPM_BUILD="npm run build"
CMD_RESTART="pm2 restart pm2.json"

echo "$ $CMD_PWD"
eval $CMD_PWD
echo "$ $CMD_FETCH"
eval $CMD_FETCH

if $GIT diff --name-only $oldrev $newrev | grep "^package-lock.json"; then
  echo "$ $CMD_NPM_INSTALL"
  eval $CMD_NPM_INSTALL
else
  echo "# Skipping npm install, lockfile not modified"
fi

echo "$ $CMD_NPM_BUILD"
eval $CMD_NPM_BUILD

echo "$ $CMD_RESTART"
eval $CMD_RESTART
