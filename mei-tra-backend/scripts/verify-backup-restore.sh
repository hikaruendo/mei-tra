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
readonly sentinel_room_id='00000000-0000-4000-8000-000000000099'
readonly sentinel_seat_id='00000000-0000-4000-8000-000000000199'
readonly sentinel_game_state_id='00000000-0000-4000-8000-000000000299'
readonly sentinel_history_id='00000000-0000-4000-8000-000000000399'

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
VALUES ('$sentinel_room_id', 'restore-drill');

INSERT INTO public.room_players (
  id,
  room_id,
  name,
  team,
  is_ready,
  is_com,
  seat_index
)
VALUES (
  '$sentinel_seat_id',
  '$sentinel_room_id',
  'restore-player',
  0,
  true,
  false,
  0
);

UPDATE public.rooms
SET host_seat_id = '$sentinel_seat_id'
WHERE id = '$sentinel_room_id';

INSERT INTO public.game_states (
  id,
  room_id,
  state_data,
  current_seat_id,
  game_phase,
  round_number,
  points_to_win
)
VALUES (
  '$sentinel_game_state_id',
  '$sentinel_room_id',
  '{"identitySchemaVersion":2,"playerStates":{}}'::jsonb,
  '$sentinel_seat_id',
  'play',
  2,
  10
);

INSERT INTO public.game_history (
  id,
  room_id,
  game_state_id,
  action_type,
  actor_seat_id,
  action_data
)
VALUES (
  '$sentinel_history_id',
  '$sentinel_room_id',
  '$sentinel_game_state_id',
  'card_played',
  '$sentinel_seat_id',
  '{"card":"A-tra"}'::jsonb
);
SQL

expected_counts="$(psql "$database_url" --tuples-only --no-align --field-separator='|' --set ON_ERROR_STOP=1 \
  --command "SELECT
    (SELECT count(*) FROM public.rooms WHERE id = '$sentinel_room_id'),
    (SELECT count(*) FROM public.room_players WHERE id = '$sentinel_seat_id'),
    (SELECT count(*) FROM public.game_states WHERE id = '$sentinel_game_state_id'),
    (SELECT count(*) FROM public.game_history WHERE id = '$sentinel_history_id');")"

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
  --command "SELECT count(*) FROM public.rooms WHERE id = '$sentinel_room_id';")" != '0' ]]; then
  echo 'Restore drill failed to clear the target application data.' >&2
  exit 1
fi

{
  echo 'SET session_replication_role = replica;'
  cat "$dump_file"
  echo 'SET session_replication_role = DEFAULT;'
} | psql "$database_url" --set ON_ERROR_STOP=1 >/dev/null

restored_counts="$(psql "$database_url" --tuples-only --no-align --field-separator='|' --set ON_ERROR_STOP=1 \
  --command "SELECT
    (SELECT count(*) FROM public.rooms WHERE id = '$sentinel_room_id'),
    (SELECT count(*) FROM public.room_players WHERE id = '$sentinel_seat_id'),
    (SELECT count(*) FROM public.game_states WHERE id = '$sentinel_game_state_id'),
    (SELECT count(*) FROM public.game_history WHERE id = '$sentinel_history_id');")"

if [[ "$restored_counts" != "$expected_counts" ]]; then
  echo "Restore drill failed: expected graph counts $expected_counts, found $restored_counts." >&2
  exit 1
fi

orphan_count="$(psql "$database_url" --tuples-only --no-align --set ON_ERROR_STOP=1 \
  --command "SELECT
    (SELECT count(*)
       FROM public.room_players AS player
       LEFT JOIN public.rooms AS room ON room.id = player.room_id
      WHERE player.room_id IS NOT NULL AND room.id IS NULL)
    +
    (SELECT count(*)
       FROM public.rooms AS room
       LEFT JOIN public.room_players AS host
         ON host.room_id = room.id AND host.id = room.host_seat_id
      WHERE room.host_seat_id IS NOT NULL AND host.id IS NULL)
    +
    (SELECT count(*)
       FROM public.game_states AS state
       LEFT JOIN public.rooms AS room ON room.id = state.room_id
      WHERE state.room_id IS NOT NULL AND room.id IS NULL)
    +
    (SELECT count(*)
       FROM public.game_states AS state
       LEFT JOIN public.room_players AS current_seat
         ON current_seat.room_id = state.room_id
        AND current_seat.id = state.current_seat_id
      WHERE state.current_seat_id IS NOT NULL AND current_seat.id IS NULL)
    +
    (SELECT count(*)
       FROM public.game_history AS history
       LEFT JOIN public.rooms AS room ON room.id = history.room_id
       LEFT JOIN public.game_states AS state ON state.id = history.game_state_id
       LEFT JOIN public.room_players AS actor
         ON actor.room_id = history.room_id
        AND actor.id = history.actor_seat_id
      WHERE (history.room_id IS NOT NULL AND room.id IS NULL)
         OR (history.game_state_id IS NOT NULL AND state.id IS NULL)
         OR (history.actor_seat_id IS NOT NULL AND actor.id IS NULL));")"

if [[ "$orphan_count" != '0' ]]; then
  echo "Restore drill failed: found $orphan_count orphaned application references." >&2
  exit 1
fi

echo 'Backup restore drill passed for the representative public application graph.'
