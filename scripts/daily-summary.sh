#!/usr/bin/env bash
# Daily retro cron-runner — calls Mission Control's /api/daily-summary.
# Install:
#   crontab -e
#   0 20 * * * /Users/aydindarchini/Desktop/AI\ mappen/Agent\ -\ workspace/mission-control/scripts/daily-summary.sh
#
# Mission Control must be running on :3000 when this fires. The Settings
# page also has a "Run today's summary now" button for manual triggers.

set -e
LOG="$HOME/.mission-control-daily.log"
ts() { date +"%Y-%m-%d %H:%M:%S"; }

{
  echo "[$(ts)] daily-summary firing"
  if ! curl -sf -o /dev/null --max-time 5 http://localhost:3000/api/health; then
    echo "[$(ts)] Mission Control not running — skipping."
    exit 0
  fi
  result=$(curl -sf --max-time 180 -X POST http://localhost:3000/api/daily-summary)
  echo "[$(ts)] ok: $result"
} >> "$LOG" 2>&1
