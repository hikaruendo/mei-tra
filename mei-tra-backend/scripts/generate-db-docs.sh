#!/usr/bin/env bash
set -euo pipefail

if ! command -v tbls >/dev/null 2>&1; then
  echo 'tbls is required. Install it with: brew install tbls' >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir/.."

export TBLS_DSN="${TBLS_DSN:-postgresql://postgres:postgres@127.0.0.1:54322/postgres?sslmode=disable}"

tbls doc --config .tbls.yml --rm-dist
