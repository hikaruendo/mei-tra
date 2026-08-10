#!/usr/bin/env bash
set -u

DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
ROOM_ID="00000000-0000-0000-0000-000000000c02"
SEAT_ID="00000000-0000-0000-0000-000000000c03"
USER_ID="00000000-0000-0000-0000-000000000c01"
TRANSITION_ID="00000000-0000-0000-0000-000000000c04"
FIRST_OUTPUT="$(mktemp)"
SECOND_OUTPUT="$(mktemp)"

cleanup() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<SQL || true
delete from public.rooms where id = '$ROOM_ID';
delete from auth.users where id = '$USER_ID';
SQL
  rm -f "$FIRST_OUTPUT" "$SECOND_OUTPUT"
}

trap cleanup EXIT
cleanup

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 >/dev/null <<SQL
insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) values (
  '$USER_ID',
  'authenticated',
  'authenticated',
  'seat-race@example.com',
  '',
  now(),
  now(),
  now()
);

update public.user_profiles
set username = 'seat_identity_race',
    display_name = 'Seat Race'
where id = '$USER_ID';

select public.reserve_room_membership(
  '$USER_ID',
  '$SEAT_ID',
  '$TRANSITION_ID'
);

select public.create_room_with_host_seat_atomic(
  '$ROOM_ID',
  'Seat concurrency room',
  '$SEAT_ID',
  '$USER_ID',
  'Seat Race',
  '{
    "maxPlayers":4,
    "isPrivate":false,
    "password":null,
    "teamAssignmentMethod":"random",
    "pointsToWin":10,
    "allowSpectators":true
  }'::jsonb,
  10,
  '$TRANSITION_ID'
);
SQL

set +e
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 >"$FIRST_OUTPUT" 2>&1 <<SQL &
select public.atomic_update_game_state(
  '$ROOM_ID',
  '{"deck":["first"]}'::jsonb,
  '{}'::jsonb,
  0
);
SQL
FIRST_PID=$!

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 >"$SECOND_OUTPUT" 2>&1 <<SQL &
select public.atomic_update_game_state(
  '$ROOM_ID',
  '{"deck":["second"]}'::jsonb,
  '{}'::jsonb,
  0
);
SQL
SECOND_PID=$!

wait "$FIRST_PID"
FIRST_STATUS=$?
wait "$SECOND_PID"
SECOND_STATUS=$?
set -e

SUCCESS_COUNT=0
if [[ "$FIRST_STATUS" -eq 0 ]]; then
  SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
fi
if [[ "$SECOND_STATUS" -eq 0 ]]; then
  SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
fi

if [[ "$SUCCESS_COUNT" -ne 1 ]]; then
  cat "$FIRST_OUTPUT" "$SECOND_OUTPUT" >&2
  echo "expected exactly one concurrent update to succeed" >&2
  exit 1
fi

VERSION="$(
  psql "$DATABASE_URL" -Atq -v ON_ERROR_STOP=1 -c \
    "select version from public.game_states where room_id = '$ROOM_ID'"
)"

if [[ "$VERSION" != "1" ]]; then
  cat "$FIRST_OUTPUT" "$SECOND_OUTPUT" >&2
  echo "expected game state version 1 after the race, got $VERSION" >&2
  exit 1
fi

echo "seat update concurrency test passed"
