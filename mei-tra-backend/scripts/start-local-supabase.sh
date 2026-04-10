#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env.development ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.development
  set +a
fi

export RESEND_API_KEY="${RESEND_API_KEY:-dummy}"

supabase start
