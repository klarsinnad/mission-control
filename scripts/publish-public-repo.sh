#!/usr/bin/env bash
# Publish mission-control as its own public GitHub repo.
#
# Two modes:
#   ./publish-public-repo.sh                 → uses `gh` to create the repo
#   ./publish-public-repo.sh <git-remote>    → pushes to a remote you provide
#
# Either way it:
#   1. Stages mission-control/ in a temp dir (excludes .env*, node_modules,
#      build artifacts).
#   2. Inits a fresh git repo there.
#   3. Pushes to GitHub.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

REMOTE_URL="${1:-}"
REPO_NAME="${REPO_NAME:-mission-control}"
REPO_VISIBILITY="${REPO_VISIBILITY:-public}"

if [ -z "$REMOTE_URL" ]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "Need either a remote URL as argument, OR \`gh\` CLI installed + authed."
    echo "  brew install gh && gh auth login"
    exit 1
  fi
  if ! gh auth status >/dev/null 2>&1; then
    echo "\`gh\` is installed but not authenticated. Run:  gh auth login"
    exit 1
  fi
fi

TMP="$(mktemp -d -t mission-control-publish-XXXXXX)"
echo "→ Staging mission-control/ in $TMP"
rsync -a \
  --exclude='node_modules/' \
  --exclude='.next/' \
  --exclude='out/' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='.env.*.local' \
  --exclude='tsconfig.tsbuildinfo' \
  --exclude='.git/' \
  "$MC_DIR/" "$TMP/"

cd "$TMP"
git init -b main -q
git add .
git commit -q -m "feat: initial release of Mission Control · Agentic OS

Locally-hosted command center for Claude and your AI agent fleet.
Talks to Claude through the local CLI (subscription — no API key),
saves every chat / goal / journal entry to your Obsidian vault,
voice input via Web Speech API, agent Control Rooms per manifest."

if [ -n "$REMOTE_URL" ]; then
  echo "→ Pushing to $REMOTE_URL"
  git remote add origin "$REMOTE_URL"
  git push -u origin main
  echo "✓ Done.  $REMOTE_URL"
else
  echo "→ Creating public repo via gh: klarsinnad/$REPO_NAME"
  gh repo create "klarsinnad/$REPO_NAME" \
    --"$REPO_VISIBILITY" \
    --description "A locally-hosted command center for Claude and your agent fleet · CLI bridge · Obsidian vault · voice" \
    --source=. --push --remote=origin
  echo "✓ Done.  https://github.com/klarsinnad/$REPO_NAME"
fi
