#!/bin/zsh

set -euo pipefail

REPO_DIR="/Users/shaylchetty/Documents/New project"
SCRAPER_SCRIPT="/Users/shaylchetty/Dev/scramble/new.py"
SCRAPER_OUTPUT_JSON="/Users/shaylchetty/Dev/scramble/profiles.json"
TARGET_JSON="$REPO_DIR/profiles.json"
STATE_DIR="$REPO_DIR/.automation-state"
LAST_RUN_FILE="$STATE_DIR/last_successful_run.txt"
LOG_FILE="$STATE_DIR/update.log"

mkdir -p "$STATE_DIR"

timestamp() {
  date "+%Y-%m-%d %H:%M:%S"
}

log() {
  printf "[%s] %s\n" "$(timestamp)" "$1" | tee -a "$LOG_FILE"
}

TODAY="$(date +%F)"

if [[ -f "$LAST_RUN_FILE" ]] && [[ "$(cat "$LAST_RUN_FILE")" == "$TODAY" ]]; then
  log "Already updated today. Exiting."
  exit 0
fi

if [[ ! -f "$SCRAPER_SCRIPT" ]]; then
  log "Scraper script not found at $SCRAPER_SCRIPT"
  exit 1
fi

cd "$REPO_DIR"

OTHER_CHANGES="$(git status --porcelain | grep -vE '^(.. )?profiles\.json$' || true)"
if [[ -n "$OTHER_CHANGES" ]]; then
  log "Repo has other local changes. Skipping automated update to avoid mixing work."
  exit 1
fi

log "Running scraper."
python3 "$SCRAPER_SCRIPT"

if [[ ! -f "$SCRAPER_OUTPUT_JSON" ]]; then
  log "Expected scraper output not found at $SCRAPER_OUTPUT_JSON"
  exit 1
fi

if cmp -s "$SCRAPER_OUTPUT_JSON" "$TARGET_JSON"; then
  log "profiles.json already up to date. No git changes needed."
  echo "$TODAY" > "$LAST_RUN_FILE"
  exit 0
fi

log "Copying fresh profiles.json into repo."
cp "$SCRAPER_OUTPUT_JSON" "$TARGET_JSON"

git add profiles.json

if git diff --cached --quiet -- profiles.json; then
  log "No staged diff after copy. Exiting."
  echo "$TODAY" > "$LAST_RUN_FILE"
  exit 0
fi

COMMIT_MESSAGE="Update profiles.json ($(date +%F))"
log "Committing updated profiles.json."
git commit -m "$COMMIT_MESSAGE"

log "Pushing to origin."
git push origin HEAD

echo "$TODAY" > "$LAST_RUN_FILE"
log "Automation finished successfully."
