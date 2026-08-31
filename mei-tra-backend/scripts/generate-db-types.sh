#!/usr/bin/env bash
set -euo pipefail

readonly GENERATED_TYPES_PATH='src/types/database.generated.types.ts'

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir/.."
readonly SUPABASE_CLI_VERSION="$(<.supabase-cli-version)"

mode="${1:-}"
if [[ -n "$mode" && "$mode" != '--check' ]]; then
  echo "Usage: $0 [--check]" >&2
  exit 2
fi

temp_file="$(mktemp "${TMPDIR:-/tmp}/meitra-database-types.XXXXXX")"
trap 'rm -f "$temp_file"' EXIT

installed_supabase_version=''
if command -v supabase >/dev/null 2>&1; then
  installed_supabase_version="$(supabase --version 2>/dev/null)"
fi

if [[ "$installed_supabase_version" == "$SUPABASE_CLI_VERSION" ]]; then
  supabase_command=(supabase)
else
  supabase_command=(npx --yes "supabase@${SUPABASE_CLI_VERSION}")
fi

if ! "${supabase_command[@]}" status >/dev/null 2>&1; then
  echo 'Local Supabase is not running. Start it with npm run supabase:start.' >&2
  exit 1
fi

"${supabase_command[@]}" gen types \
  --lang typescript \
  --schema public \
  --local > "$temp_file"

npx --no-install prettier \
  --config .prettierrc \
  --parser typescript \
  --write "$temp_file" >/dev/null

if [[ "$mode" == '--check' ]]; then
  if cmp -s "$temp_file" "$GENERATED_TYPES_PATH"; then
    echo 'Generated database types are up to date.'
    exit 0
  fi

  echo 'Generated database types are out of date.' >&2
  diff -u "$GENERATED_TYPES_PATH" "$temp_file" || true
  echo 'Run npm run db:types with local Supabase running.' >&2
  exit 1
fi

mv "$temp_file" "$GENERATED_TYPES_PATH"
trap - EXIT
echo "Updated $GENERATED_TYPES_PATH with Supabase CLI $SUPABASE_CLI_VERSION."
