#!/usr/bin/env bash
# Re-import Claude Code sessions into the vault. Runs every 30 min via
# launchd. Skips if MC isn't running. Idempotent thanks to mtime tracking
# in lib/import-claude.ts — only sessions whose .jsonl has grown get
# rewritten.

set -e
LOG="$HOME/.mission-control-import.log"
ts() { date +"%Y-%m-%d %H:%M:%S"; }

{
  if ! curl -sf -o /dev/null --max-time 5 http://localhost:3000/api/health; then
    echo "[$(ts)] MC not running — skipping import"
    exit 0
  fi
  result=$(curl -sf --max-time 120 -X POST "http://localhost:3000/api/import?source=claude" || echo '{"error":"network"}')
  echo "[$(ts)] $result"
} >> "$LOG" 2>&1
