#!/bin/zsh

set -euo pipefail

REPO_DIR="/Users/shaylchetty/Documents/New project"
SCRAPER_SCRIPT="/Users/shaylchetty/Dev/scramble/new.py"
SCRAPER_PYTHON="/Users/shaylchetty/Dev/scramble/venv/bin/python"
SCRAPER_OUTPUT_JSON="/Users/shaylchetty/Dev/scramble/profiles.json"
TARGET_JSON="$REPO_DIR/profiles.json"
STATE_DIR="$REPO_DIR/.automation-state"
LAST_RUN_SLOT_FILE="$STATE_DIR/last_successful_run_slot.txt"
LOG_FILE="$STATE_DIR/update.log"
LAUNCH_AGENT_PATH="$HOME/Library/LaunchAgents/com.shaylchetty.senior-scramble-update.plist"
STOP_ON_OR_AFTER="2026-05-01"

mkdir -p "$STATE_DIR"

timestamp() {
  date "+%Y-%m-%d %H:%M:%S"
}

log() {
  printf "[%s] %s\n" "$(timestamp)" "$1" | tee -a "$LOG_FILE"
}

TODAY="$(date +%F)"
CURRENT_HOUR="$(date +%H)"
RUN_SLOT="am"

if (( 10#$CURRENT_HOUR >= 12 )); then
  RUN_SLOT="pm"
fi

CURRENT_RUN_MARKER="$TODAY-$RUN_SLOT"

if [[ "$TODAY" > "$STOP_ON_OR_AFTER" || "$TODAY" == "$STOP_ON_OR_AFTER" ]]; then
  log "Stop date reached. Disabling launch agent."
  launchctl unload "$LAUNCH_AGENT_PATH" 2>/dev/null || true
  rm -f "$LAUNCH_AGENT_PATH"
  exit 0
fi

if [[ -f "$LAST_RUN_SLOT_FILE" ]] && [[ "$(cat "$LAST_RUN_SLOT_FILE")" == "$CURRENT_RUN_MARKER" ]]; then
  log "Already updated during the $RUN_SLOT window today. Exiting."
  exit 0
fi

if [[ ! -f "$SCRAPER_SCRIPT" ]]; then
  log "Scraper script not found at $SCRAPER_SCRIPT"
  exit 1
fi

if [[ ! -x "$SCRAPER_PYTHON" ]]; then
  log "Scraper Python interpreter not found or not executable at $SCRAPER_PYTHON"
  exit 1
fi

cd "$REPO_DIR"

OTHER_CHANGES="$(git status --porcelain | grep -vE '^(.. )?profiles\.json$' || true)"
if [[ -n "$OTHER_CHANGES" ]]; then
  log "Repo has other local changes. Skipping automated update to avoid mixing work."
  exit 1
fi

log "Running scraper."
"$SCRAPER_PYTHON" "$SCRAPER_SCRIPT"

if [[ -f "$SCRAPER_OUTPUT_JSON" ]] && [[ "$SCRAPER_OUTPUT_JSON" != "$TARGET_JSON" ]]; then
  if cmp -s "$SCRAPER_OUTPUT_JSON" "$TARGET_JSON"; then
    log "profiles.json already up to date. No git changes needed."
    echo "$CURRENT_RUN_MARKER" > "$LAST_RUN_SLOT_FILE"
    exit 0
  fi

  log "Copying fresh profiles.json into repo."
  cp "$SCRAPER_OUTPUT_JSON" "$TARGET_JSON"
elif [[ -f "$TARGET_JSON" ]]; then
  log "Scraper wrote profiles.json directly into the repo."
else
  log "Could not find scraper output at either $SCRAPER_OUTPUT_JSON or $TARGET_JSON"
  exit 1
fi

git add profiles.json

if git diff --cached --quiet -- profiles.json; then
  log "No staged diff after copy. Exiting."
  echo "$CURRENT_RUN_MARKER" > "$LAST_RUN_SLOT_FILE"
  exit 0
fi

COMMIT_MESSAGE="Update profiles.json ($(date +%F))"
log "Committing updated profiles.json."
git commit -m "$COMMIT_MESSAGE"

log "Pushing to origin."
git push origin HEAD

echo "$CURRENT_RUN_MARKER" > "$LAST_RUN_SLOT_FILE"
log "Automation finished successfully."
