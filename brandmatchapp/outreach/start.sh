#!/usr/bin/env bash
# One launch, nothing to remember. The macOS and Linux twin of start.cmd.
set -e
cd "$(dirname "$0")"

if [ ! -f config/settings.json ]; then
  echo "No config/settings.json yet."
  echo "Copy config/settings.example.json to config/settings.json and set your account."
  exit 1
fi

[ -d node_modules ] || npm install --no-audit --no-fund
npm run build
node dist/cli.js run "$@"
