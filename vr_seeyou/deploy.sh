#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT="${APP_ROOT:-/var/www/seeyou-repo/vr_seeyou}"
BRANCH="${BRANCH:-codex/vr-seeyou-current-version}"
PM2_APP="${PM2_APP:-seeyou-backend}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"

BACKEND_DIR="$APP_ROOT/backend"
FRONTEND_DIR="$APP_ROOT/frontend"
BACKUP_DIR="$APP_ROOT/backups"
DB_PATH="$BACKEND_DIR/data/wardrobe.db"

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

cd "$APP_ROOT"

require_command git
require_command npm
require_command pm2
require_command curl

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  printf 'APP_ROOT is not inside a git repository: %s\n' "$APP_ROOT" >&2
  exit 1
fi

if [ ! -f "$BACKEND_DIR/.env" ]; then
  printf 'Missing backend env file: %s\n' "$BACKEND_DIR/.env" >&2
  exit 1
fi

if [ -n "$(git status --porcelain --untracked-files=no -- .)" ]; then
  printf 'Tracked files under %s have local changes. Commit, stash, or inspect them before deploy.\n' "$APP_ROOT" >&2
  git status --short -- .
  exit 1
fi

log "Fetching latest code from origin"
git fetch origin

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git checkout "$BRANCH"
else
  git checkout -b "$BRANCH" "origin/$BRANCH"
fi

git pull --ff-only origin "$BRANCH"

mkdir -p "$BACKUP_DIR"
if [ -f "$DB_PATH" ]; then
  backup_file="$BACKUP_DIR/wardrobe.$(date '+%Y%m%d%H%M%S').db"
  cp "$DB_PATH" "$backup_file"
  log "Backed up SQLite database to $backup_file"
else
  log "No SQLite database found at $DB_PATH; skipping backup"
fi

log "Installing backend dependencies"
cd "$BACKEND_DIR"
npm ci
npm rebuild sqlite3 --build-from-source
npm run check

log "Building frontend"
cd "$FRONTEND_DIR"
npm ci
npm run build

log "Restarting backend with PM2"
if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP" --update-env
else
  pm2 start "$BACKEND_DIR/server.js" --name "$PM2_APP" --cwd "$BACKEND_DIR"
fi

pm2 save

log "Checking backend health"
curl --fail --silent --show-error "$HEALTH_URL"
printf '\n'

log "Deploy finished successfully"
