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

installed_supabase_version=''
if command -v supabase >/dev/null 2>&1; then
  installed_supabase_version="$(supabase --version 2>/dev/null)"
fi

if [[ "$installed_supabase_version" == "$SUPABASE_CLI_VERSION" ]]; then
  supabase_command=(supabase)
else
  supabase_command=(npx --yes "supabase@${SUPABASE_CLI_VERSION}")
fi

temporary_project_root="$(mktemp -d "${TMPDIR:-/tmp}/meitra-database-types.XXXXXX")"
temp_file="$temporary_project_root/database.generated.types.ts"

cleanup() {
  "${supabase_command[@]}" stop \
    --workdir "$temporary_project_root" \
    --no-backup >/dev/null 2>&1 || true
  if [[ -d "$temporary_project_root" ]]; then
    find "$temporary_project_root" -depth -delete
  fi
}
trap cleanup EXIT

mkdir -p "$temporary_project_root/supabase"
cp supabase/config.toml "$temporary_project_root/supabase/config.toml"
cp -R supabase/migrations "$temporary_project_root/supabase/migrations"
cp -R supabase/templates "$temporary_project_root/supabase/templates"

database_port="$(node -e "const s=require('node:net').createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})")"
temporary_project_id="meitra-db-types-$$"

perl -0pi -e \
  "s/project_id = \"[^\"]+\"/project_id = \"$temporary_project_id\"/; s/port = 54322/port = $database_port/" \
  "$temporary_project_root/supabase/config.toml"

"${supabase_command[@]}" db start --workdir "$temporary_project_root"

"${supabase_command[@]}" gen types \
  --lang typescript \
  --schema public \
  --local \
  --workdir "$temporary_project_root" > "$temp_file"

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
  echo 'Run npm run db:types to regenerate them from the migrations.' >&2
  exit 1
fi

cp "$temp_file" "$GENERATED_TYPES_PATH"
echo "Updated $GENERATED_TYPES_PATH with Supabase CLI $SUPABASE_CLI_VERSION."
