#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env.development ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.development
  set +a
fi

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

supabase start

echo
echo "Local auth emails are available in Mailpit:"
echo "  http://localhost:54324"
