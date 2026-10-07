#!/bin/sh
# Every 10 minutes: copy the agents' output into a clone of the repo and push if anything changed. Vercel redeploys on push.
# Needs KEEL_REPO (git@github.com:you/keel.git), KEEL_BRANCH, and an SSH deploy key with write access at /root/.ssh/id_ed25519.
set -eu
: "${KEEL_REPO:?set KEEL_REPO}"; BRANCH="${KEEL_BRANCH:-main}"; SRC="${KEEL_DATA_SRC:-/data-in}"; DIR=/tmp/keel-publish
export GIT_SSH_COMMAND="ssh -i /root/.ssh/id_ed25519 -o StrictHostKeyChecking=accept-new"
[ -d "$DIR/.git" ] || git clone --depth 1 --branch "$BRANCH" "$KEEL_REPO" "$DIR"
cd "$DIR"; git config user.name "keel-agents"; git config user.email "agents@keel.invalid"
while true; do
  git pull -q --rebase origin "$BRANCH" || true
  for d in outlook community agents history.json rules.json; do [ -e "$SRC/$d" ] && { rm -rf "public/data/$d"; cp -R "$SRC/$d" "public/data/$d"; }; done
  if [ -n "$(git status --porcelain public/data)" ]; then
    git add public/data && git commit -q -m "data: agents update $(date -u +%FT%TZ)" && git push -q origin "HEAD:$BRANCH" && echo "published"
  fi
  sleep 600
done
