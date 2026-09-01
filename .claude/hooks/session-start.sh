#!/bin/bash
# SessionStart hook for Claude Code on the web.
#
# Why this exists: package.json points its two optional callback-box tools
# (@ianbicking/personal-vibe-check, agent-doctest) at a file: path outside the
# repo — ../../../workspace/callback-box/... — which matches Ian's local layout,
# not the cloud one. In a web session both repos are cloned as siblings
# (e.g. /home/user/intra-game and /home/user/callback-box), so that file: path
# points nowhere and pnpm silently skips the tools. Then `pnpm test`/`pnpm lint`
# fail with "cannot find module".
#
# Fix: symlink the location the file: path expects to the sibling callback-box
# checkout, then install. Local dev is untouched (this only runs on the web).
#
# Idempotent and non-interactive; safe to re-run.
set -euo pipefail

# Web sessions only. Local dev already resolves the file: path.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Derive the repo root from this script's own location so we don't depend on
# CLAUDE_PROJECT_DIR being set: <repo>/.claude/hooks/session-start.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# The absolute path the file: dependency resolves to (lexical, no symlinks),
# and where callback-box actually is (a sibling of this repo).
LINK_PATH="$(realpath -ms "$PROJECT_DIR/../../../workspace/callback-box")"
CB_SRC="$(dirname "$PROJECT_DIR")/callback-box"

if [ -d "$CB_SRC" ]; then
  # Point LINK_PATH at CB_SRC unless it already does.
  if [ "$(readlink -f "$LINK_PATH" 2>/dev/null || true)" != "$(readlink -f "$CB_SRC")" ]; then
    mkdir -p "$(dirname "$LINK_PATH")"
    ln -sfn "$CB_SRC" "$LINK_PATH"
    echo "session-start: linked $LINK_PATH -> $CB_SRC"
  fi
else
  echo "session-start: WARNING callback-box not found at $CB_SRC;" \
       "the personal-vibe-check/agent-doctest tools will be skipped and" \
       "pnpm test/lint will fail with 'cannot find module'." >&2
fi

cd "$PROJECT_DIR"
corepack enable >/dev/null 2>&1 || true
pnpm install

# Note: the first `pnpm test` in a fresh container can under-count / spuriously
# fail while tsx+esbuild compile cold (tap spawns doctest files in parallel).
# It is not a real failure; re-run and the count is stable and complete.
#
# If callback-box is missing above, it is a repo of Ian's and can be cloned as a
# sibling: git clone --depth 1 https://github.com/ianb/callback-box \
#   "$(dirname "$PROJECT_DIR")/callback-box", then re-run this script.
