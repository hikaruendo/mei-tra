#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir/.."
readonly SUPABASE_CLI_VERSION="$(<.supabase-cli-version)"

installed_supabase_version=''
if command -v supabase >/dev/null 2>&1; then
  installed_supabase_version="$(supabase --version 2>/dev/null)"
fi

if [[ "$installed_supabase_version" == "$SUPABASE_CLI_VERSION" ]]; then
  supabase_command=(supabase)
else
  supabase_command=(npx --yes "supabase@${SUPABASE_CLI_VERSION}")
fi

for command_name in node perl psql; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command is unavailable: $command_name" >&2
    exit 1
  fi
done

temporary_project_root="$(mktemp -d "${TMPDIR:-/tmp}/meitra-restore-drill.XXXXXX")"
dump_file="$temporary_project_root/public-data.sql"
readonly sentinel_id='00000000-0000-4000-8000-000000000099'

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
temporary_project_id="meitra-restore-drill-$$"

perl -0pi -e \
  "s/project_id = \"[^\"]+\"/project_id = \"$temporary_project_id\"/; s/port = 54322/port = $database_port/" \
  "$temporary_project_root/supabase/config.toml"

database_url="postgresql://postgres:postgres@127.0.0.1:${database_port}/postgres"

"${supabase_command[@]}" db start --workdir "$temporary_project_root"

psql "$database_url" --set ON_ERROR_STOP=1 <<SQL
INSERT INTO public.rooms (id, name)
VALUES ('$sentinel_id', 'restore-drill');
SQL

"${supabase_command[@]}" db dump \
  --local \
  --workdir "$temporary_project_root" \
  --data-only \
  --use-copy \
  --schema public \
  --file "$dump_file"

if [[ ! -s "$dump_file" ]]; then
  echo 'Restore drill dump is empty.' >&2
  exit 1
fi

psql "$database_url" --tuples-only --no-align --set ON_ERROR_STOP=1 \
  --command "SELECT format('TRUNCATE TABLE %I.%I CASCADE;', schemaname, tablename) FROM pg_tables WHERE schemaname = 'public';" \
  | psql "$database_url" --set ON_ERROR_STOP=1 >/dev/null

if [[ "$(psql "$database_url" --tuples-only --no-align --set ON_ERROR_STOP=1 \
  --command "SELECT count(*) FROM public.rooms WHERE id = '$sentinel_id';")" != '0' ]]; then
  echo 'Restore drill failed to clear the target application data.' >&2
  exit 1
fi

{
  echo 'SET session_replication_role = replica;'
  cat "$dump_file"
  echo 'SET session_replication_role = DEFAULT;'
} | psql "$database_url" --set ON_ERROR_STOP=1 >/dev/null

restored_count="$(psql "$database_url" --tuples-only --no-align --set ON_ERROR_STOP=1 \
  --command "SELECT count(*) FROM public.rooms WHERE id = '$sentinel_id';")"

if [[ "$restored_count" != '1' ]]; then
  echo "Restore drill failed: expected one sentinel room, found $restored_count." >&2
  exit 1
fi

echo 'Backup restore drill passed for the public application schema.'
