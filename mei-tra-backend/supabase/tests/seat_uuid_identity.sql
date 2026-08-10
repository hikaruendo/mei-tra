begin;

select plan(46);

select has_column('rooms', 'host_seat_id');
select has_column('game_states', 'current_seat_id');
select has_column('game_history', 'actor_seat_id');
select has_column('active_room_memberships', 'seat_id');

select is(
  (
    select constraint_type
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'room_players'
      and constraint_name = 'room_players_user_id_fkey'
  ),
  'FOREIGN KEY',
  'room_players.user_id remains a foreign key'
);

select ok(
  to_regprocedure(
    'public.create_room_with_host_seat_atomic(uuid,text,uuid,uuid,text,jsonb,integer,uuid)'
  ) is not null,
  'atomic room and host-seat creation RPC exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.create_room_with_host_seat_atomic(uuid,text,uuid,uuid,text,jsonb,integer,uuid)',
    'execute'
  ),
  'anonymous clients cannot create canonical rooms directly'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000a01',
  'authenticated',
  'authenticated',
  'seat-host-1@example.com',
  '',
  now(),
  now(),
  now()
);

update public.user_profiles
set username = 'seat_identity_host_a',
    display_name = 'Seat Host A'
where id = '00000000-0000-0000-0000-000000000a01';

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000b01',
  'authenticated',
  'authenticated',
  'seat-host-2@example.com',
  '',
  now(),
  now(),
  now()
);

update public.user_profiles
set username = 'seat_identity_host_b',
    display_name = 'Seat Host B'
where id = '00000000-0000-0000-0000-000000000b01';

select is(
  (
    public.reserve_room_membership(
      '00000000-0000-0000-0000-000000000a01',
      '00000000-0000-0000-0000-000000000a03',
      '00000000-0000-0000-0000-000000000a04'
    )->>'result'
  ),
  'reserved',
  'host membership is reserved before atomic room creation'
);

select public.create_room_with_host_seat_atomic(
  '00000000-0000-0000-0000-000000000a02',
  'Seat identity room A',
  '00000000-0000-0000-0000-000000000a03',
  '00000000-0000-0000-0000-000000000a01',
  'Seat Host A',
  '{
    "maxPlayers":4,
    "isPrivate":false,
    "password":null,
    "teamAssignmentMethod":"random",
    "pointsToWin":10,
    "allowSpectators":true
  }'::jsonb,
  10,
  '00000000-0000-0000-0000-000000000a04'
);

select is(
  (
    select host_seat_id
    from public.rooms
    where id = '00000000-0000-0000-0000-000000000a02'
  ),
  '00000000-0000-0000-0000-000000000a03'::uuid,
  'room host points at the canonical host seat'
);

select is(
  (
    select id
    from public.room_players
    where room_id = '00000000-0000-0000-0000-000000000a02'
      and seat_index = 0
  ),
  '00000000-0000-0000-0000-000000000a03'::uuid,
  'host room-player row uses the preallocated seat UUID'
);

select is(
  (
    select seat_id
    from public.active_room_memberships
    where user_id = '00000000-0000-0000-0000-000000000a01'
  ),
  '00000000-0000-0000-0000-000000000a03'::uuid,
  'active membership resolves to the same seat UUID'
);

select is(
  (
    select state_data->>'identitySchemaVersion'
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000a02'
  ),
  '2',
  'new rooms persist identity schema version 2'
);

select public.persist_room_roster_atomic(
  '00000000-0000-0000-0000-000000000a02',
  '[{
    "seatId":"00000000-0000-0000-0000-000000000a03",
    "playerId":"00000000-0000-0000-0000-000000000a03",
    "participantKey":"com-timeout-a",
    "userId":null,
    "name":"COM",
    "team":0,
    "isReady":true,
    "isHost":true,
    "isCOM":true,
    "joinedAt":"2026-08-10T00:00:00.000Z",
    "seatIndex":0
  }]'::jsonb,
  '{
    "00000000-0000-0000-0000-000000000a03": {
      "hand":["S1"],
      "isPasser":false,
      "hasBroken":false,
      "hasRequiredBroken":false
    }
  }'::jsonb,
  '00000000-0000-0000-0000-000000000a03',
  0,
  '{
    "blowState": {
      "currentTrump": null,
      "currentHighestDeclaration": null,
      "declarations": [],
      "actionHistory": [],
      "lastPasserSeatId": "00000000-0000-0000-0000-000000000a03",
      "lastPasser": "00000000-0000-0000-0000-000000000a03",
      "isRoundCancelled": false,
      "currentBlowIndex": 0
    }
  }'::jsonb,
  '{
    "currentSeatId": "00000000-0000-0000-0000-000000000a03",
    "gamePhase": "blow"
  }'::jsonb,
  '{
    "type": "release",
    "seatId": "00000000-0000-0000-0000-000000000a03",
    "transitionId": "00000000-0000-0000-0000-000000000a06"
  }'::jsonb
);

select is(
  (
    select id
    from public.room_players
    where room_id = '00000000-0000-0000-0000-000000000a02'
      and seat_index = 0
  ),
  '00000000-0000-0000-0000-000000000a03'::uuid,
  'human to COM conversion preserves the seat UUID'
);

select is(
  (
    select player_id
    from public.room_players
    where id = '00000000-0000-0000-0000-000000000a03'
  ),
  'com-timeout-a',
  'legacy occupant key can change without replacing the seat'
);

select is(
  (
    select host_id
    from public.rooms
    where id = '00000000-0000-0000-0000-000000000a02'
  ),
  '00000000-0000-0000-0000-000000000a03',
  'legacy host alias dual-writes the canonical seat UUID'
);

select is(
  (
    select version
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000a02'
  ),
  1::bigint,
  'roster and game state update share one versioned write'
);

select is(
  (
    select state_data->'blowState'->>'lastPasserSeatId'
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000a02'
  ),
  '00000000-0000-0000-0000-000000000a03',
  'roster RPC persists canonical JSON seat references atomically'
);

select is(
  (
    select game_phase::text
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000a02'
  ),
  'blow',
  'roster RPC persists scalar game state atomically'
);

select ok(
  not exists (
    select 1
    from public.active_room_memberships
    where user_id = '00000000-0000-0000-0000-000000000a01'
  ),
  'roster and membership release commit in the same transaction'
);

select throws_ok(
  $$
    select public.persist_room_roster_atomic(
      '00000000-0000-0000-0000-000000000a02',
      '[{
        "seatId":"00000000-0000-0000-0000-000000000a03",
        "playerId":"00000000-0000-0000-0000-000000000a03",
        "participantKey":"must-roll-back",
        "name":"COM",
        "team":0,
        "isReady":true,
        "isHost":true,
        "isCOM":true,
        "seatIndex":0
      }]'::jsonb,
      '{
        "00000000-0000-0000-0000-000000000a03": {
          "hand":[],
          "isPasser":false,
          "hasBroken":false,
          "hasRequiredBroken":false
        }
      }'::jsonb,
      'missing-host',
      1
    )
  $$,
  'PT422',
  null,
  'a late RPC failure aborts the whole roster transaction'
);

select is(
  (
    select player_id
    from public.room_players
    where id = '00000000-0000-0000-0000-000000000a03'
  ),
  'com-timeout-a',
  'failed roster RPC rolls the earlier occupant update back'
);

select public.atomic_update_game_state(
  '00000000-0000-0000-0000-000000000a02',
  '{"deck":["H2"]}'::jsonb,
  '{"currentSeatId":"00000000-0000-0000-0000-000000000a03"}'::jsonb,
  1
);

select is(
  (
    select current_seat_id
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000a02'
  ),
  '00000000-0000-0000-0000-000000000a03'::uuid,
  'current turn writes the canonical seat UUID'
);

select is(
  (
    select current_player_id
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000a02'
  ),
  '00000000-0000-0000-0000-000000000a03',
  'legacy current-player alias mirrors current_seat_id'
);

select is(
  (
    public.reserve_room_membership(
      '00000000-0000-0000-0000-000000000b01',
      '00000000-0000-0000-0000-000000000b03',
      '00000000-0000-0000-0000-000000000b04'
    )->>'result'
  ),
  'reserved',
  'second room host membership is reserved'
);

select public.create_room_with_host_seat_atomic(
  '00000000-0000-0000-0000-000000000b02',
  'Seat identity room B',
  '00000000-0000-0000-0000-000000000b03',
  '00000000-0000-0000-0000-000000000b01',
  'Seat Host B',
  '{
    "maxPlayers":4,
    "isPrivate":false,
    "password":null,
    "teamAssignmentMethod":"random",
    "pointsToWin":10,
    "allowSpectators":true
  }'::jsonb,
  10,
  '00000000-0000-0000-0000-000000000b04'
);

set constraints game_states_current_seat_same_room_fkey immediate;
set constraints rooms_host_seat_same_room_fkey immediate;
set constraints game_history_actor_seat_same_room_fkey immediate;

select throws_ok(
  $$
    update public.rooms
    set host_seat_id = '00000000-0000-0000-0000-000000000b03'
    where id = '00000000-0000-0000-0000-000000000a02'
  $$,
  '23503',
  null,
  'a host cannot reference a seat in another room'
);

select throws_ok(
  $$
    update public.game_states
    set current_seat_id = '00000000-0000-0000-0000-000000000b03'
    where room_id = '00000000-0000-0000-0000-000000000a02'
  $$,
  '23503',
  null,
  'a current turn cannot reference a seat in another room'
);

select throws_ok(
  $$
    update public.room_players
    set id = '00000000-0000-0000-0000-000000000aff'
    where id = '00000000-0000-0000-0000-000000000a03'
  $$,
  'PT422',
  null,
  'an existing seat UUID cannot be changed'
);

select throws_ok(
  $$
    update public.room_players
    set seat_index = 7
    where id = '00000000-0000-0000-0000-000000000a03'
  $$,
  'PT422',
  null,
  'an existing seat index cannot be changed'
);

select throws_ok(
  $$
    update public.room_players
    set room_id = '00000000-0000-0000-0000-000000000b02'
    where id = '00000000-0000-0000-0000-000000000a03'
  $$,
  'PT422',
  null,
  'an existing seat cannot move to another room'
);

select throws_ok(
  $$
    select public.persist_room_roster_atomic(
      '00000000-0000-0000-0000-000000000b02',
      '[]'::jsonb,
      '{}'::jsonb,
      '00000000-0000-0000-0000-000000000b03',
      0
    )
  $$,
  'PT422',
  null,
  'roster persistence cannot omit an existing seat'
);

update public.rooms
set host_id = '00000000-0000-0000-0000-000000000b01'
where id = '00000000-0000-0000-0000-000000000b02';

select is(
  (
    select host_seat_id
    from public.rooms
    where id = '00000000-0000-0000-0000-000000000b02'
  ),
  '00000000-0000-0000-0000-000000000b03'::uuid,
  'legacy host writes resolve to the canonical seat'
);

select is(
  (
    select host_id
    from public.rooms
    where id = '00000000-0000-0000-0000-000000000b02'
  ),
  '00000000-0000-0000-0000-000000000b03',
  'legacy host alias is normalized to the canonical seat UUID'
);

update public.game_states
set current_player_id = '00000000-0000-0000-0000-000000000b01'
where room_id = '00000000-0000-0000-0000-000000000b02';

select is(
  (
    select current_seat_id
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000b02'
  ),
  '00000000-0000-0000-0000-000000000b03'::uuid,
  'legacy current-player writes resolve to the canonical seat'
);

insert into public.game_history (
  id,
  room_id,
  game_state_id,
  action_type,
  player_id,
  action_data
)
select
  '00000000-0000-0000-0000-000000000a05',
  game_state.room_id,
  game_state.id,
  'card_played',
  'com-timeout-a',
  '{}'::jsonb
from public.game_states as game_state
where game_state.room_id = '00000000-0000-0000-0000-000000000a02';

select is(
  (
    select actor_seat_id
    from public.game_history
    where id = '00000000-0000-0000-0000-000000000a05'
  ),
  '00000000-0000-0000-0000-000000000a03'::uuid,
  'history resolves its canonical actor seat'
);

select is(
  (
    select actor_key_snapshot
    from public.game_history
    where id = '00000000-0000-0000-0000-000000000a05'
  ),
  'com-timeout-a',
  'history retains the original actor key snapshot'
);

select throws_ok(
  $$
    update public.game_history
    set actor_seat_id = '00000000-0000-0000-0000-000000000b03'
    where id = '00000000-0000-0000-0000-000000000a05'
  $$,
  '23503',
  null,
  'history cannot reference an actor seat in another room'
);

insert into public.game_history (
  id,
  room_id,
  game_state_id,
  action_type,
  player_id,
  action_data
)
select
  '00000000-0000-0000-0000-000000000b05',
  game_state.room_id,
  game_state.id,
  'game_started',
  '00000000-0000-0000-0000-000000000b03',
  '{}'::jsonb
from public.game_states as game_state
where game_state.room_id = '00000000-0000-0000-0000-000000000b02';

update public.rooms
set status = 'finished'
where id = '00000000-0000-0000-0000-000000000b02';

select ok(
  public.mark_account_deletion_started(
    '00000000-0000-0000-0000-000000000b01'
  ) is not null,
  'finished-room account deletion can begin'
);

select ok(
  public.anonymize_account_references(
    '00000000-0000-0000-0000-000000000b01'
  ) is not null,
  'account references are anonymized without deleting the seat'
);

select is(
  (
    select host_id
    from public.rooms
    where id = '00000000-0000-0000-0000-000000000b02'
  ),
  '00000000-0000-0000-0000-000000000b03',
  'account anonymization keeps the legacy host alias on the seat UUID'
);

delete from auth.users
where id = '00000000-0000-0000-0000-000000000b01';

select ok(
  exists (
    select 1
    from public.room_players
    where id = '00000000-0000-0000-0000-000000000b03'
  ),
  'account deletion keeps the seat row'
);

select ok(
  exists (
    select 1
    from public.room_players
    where id = '00000000-0000-0000-0000-000000000b03'
      and user_id is null
  ),
  'account deletion clears only the seat occupant account reference'
);

select is(
  (
    select name
    from public.room_players
    where id = '00000000-0000-0000-0000-000000000b03'
  ),
  'Deleted user',
  'account deletion anonymizes the seat occupant name'
);

select ok(
  exists (
    select 1
    from public.game_history
    where id = '00000000-0000-0000-0000-000000000b05'
      and actor_seat_id = '00000000-0000-0000-0000-000000000b03'
  ),
  'account deletion keeps history linked to the seat snapshot'
);

select throws_ok(
  $$
    delete from public.room_players
    where id = '00000000-0000-0000-0000-000000000a03'
  $$,
  'PT422',
  null,
  'a seat row cannot be deleted while its room still exists'
);

select lives_ok(
  $$
    delete from public.rooms
    where id = '00000000-0000-0000-0000-000000000a02'
  $$,
  'room deletion resolves the circular host-seat relation through cascades'
);

select is(
  array(
    select table_name || '.' || column_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name like '%\_id' escape '\'
      and data_type not in ('uuid', 'bigint')
    order by 1
  ),
  array[
    'active_room_memberships.player_id',
    'game_history.player_id',
    'game_states.current_player_id',
    'push_receipts.device_id',
    'push_receipts.expo_receipt_id',
    'push_receipts.worker_id',
    'push_tokens.device_id',
    'room_players.player_id',
    'room_players.socket_id',
    'rooms.host_id'
  ]::text[],
  'non-UUID internal ID columns cannot grow beyond the migration allowlist'
);

select * from finish();

rollback;
