begin;

select plan(36);

select col_type_is(
  'public',
  'room_players',
  'id',
  'uuid',
  'room_players.id is the canonical seat UUID'
);

select hasnt_column(
  'public',
  'room_players',
  'player_id',
  'room_players.player_id is removed'
);

select hasnt_column(
  'public',
  'room_players',
  'socket_id',
  'room_players.socket_id is removed'
);

select hasnt_column(
  'public',
  'room_players',
  'is_host',
  'room_players.is_host is removed'
);

select hasnt_column(
  'public',
  'rooms',
  'host_id',
  'rooms.host_id is removed'
);

select col_type_is(
  'public',
  'rooms',
  'host_seat_id',
  'uuid',
  'rooms.host_seat_id stores the canonical host seat'
);

select hasnt_column(
  'public',
  'game_states',
  'current_player_id',
  'game_states.current_player_id is removed'
);

select col_type_is(
  'public',
  'game_states',
  'current_seat_id',
  'uuid',
  'game_states.current_seat_id stores the canonical turn seat'
);

select hasnt_column(
  'public',
  'game_history',
  'player_id',
  'game_history.player_id is removed'
);

select col_type_is(
  'public',
  'game_history',
  'actor_seat_id',
  'uuid',
  'game_history.actor_seat_id stores the canonical actor seat'
);

select hasnt_column(
  'public',
  'active_room_memberships',
  'player_id',
  'active_room_memberships.player_id is removed'
);

select col_type_is(
  'public',
  'active_room_memberships',
  'seat_id',
  'uuid',
  'active_room_memberships.seat_id stores a seat UUID'
);

select ok(
  (
    select is_nullable = 'NO'
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'active_room_memberships'
      and column_name = 'seat_id'
  ),
  'active room memberships always identify a seat'
);

select col_type_is(
  'public',
  'room_membership_events',
  'seat_id',
  'uuid',
  'membership events optionally retain a seat UUID'
);

select hasnt_column(
  'meitra_private',
  'account_anonymization_player_map',
  'original_player_id',
  'account anonymization no longer stores an original player key'
);

select hasnt_column(
  'meitra_private',
  'account_anonymization_player_map',
  'anonymized_player_id',
  'account anonymization no longer creates a replacement player key'
);

select ok(
  not has_function_privilege(
    'anon',
    'meitra_private.canonicalize_state_identity_json(jsonb)',
    'execute'
  ),
  'anonymous clients cannot invoke state identity canonicalization'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'meitra_private.scrub_account_player_names(jsonb,jsonb,boolean)',
    'execute'
  ),
  'authenticated clients cannot invoke account name scrubbing'
);

select ok(
  not has_function_privilege(
    'anon',
    'meitra_private.assert_state_identity_references(uuid,jsonb)',
    'execute'
  ),
  'anonymous clients cannot invoke state reference validation'
);

select is(
  (
    select count(*)::integer
    from pg_proc as procedure
    join pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname in ('public', 'meitra_private')
      and procedure.proname in (
        'sync_active_room_membership_seat',
        'sync_room_membership_event_seat',
        'sync_game_history_actor_seat',
        'sync_game_state_current_seat_identity',
        'sync_room_host_seat_identity',
        'keep_anonymized_host_on_seat_id',
        'resolve_room_seat_id',
        'scrub_account_references'
      )
  ),
  0,
  'legacy identity synchronization functions are removed'
);

insert into auth.users (
  id,
  email,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000931',
  'seat-identity-test@example.com',
  '{"username":"seat_identity_test","display_name":"Seat Identity Test"}'::jsonb,
  now(),
  now()
);

insert into public.rooms (id, name, host_seat_id)
values
  (
    '00000000-0000-0000-0000-000000000932',
    'Seat identity room A',
    '00000000-0000-4000-8000-000000000934'
  ),
  (
    '00000000-0000-0000-0000-000000000933',
    'Seat identity room B',
    '00000000-0000-4000-8000-000000000935'
  );

insert into public.room_players (
  id,
  room_id,
  user_id,
  name,
  team,
  is_com,
  seat_index
)
values
  (
    '00000000-0000-4000-8000-000000000934',
    '00000000-0000-0000-0000-000000000932',
    '00000000-0000-0000-0000-000000000931',
    'Player 1',
    0,
    false,
    0
  ),
  (
    '00000000-0000-4000-8000-000000000935',
    '00000000-0000-0000-0000-000000000933',
    null,
    'COM',
    1,
    true,
    0
  );

insert into public.game_states (
  room_id,
  state_data,
  current_seat_id
)
values
  (
    '00000000-0000-0000-0000-000000000932',
    '{"identitySchemaVersion":2,"playerStates":{"00000000-0000-4000-8000-000000000934":{"hand":[]}}}'::jsonb,
    '00000000-0000-4000-8000-000000000934'
  ),
  (
    '00000000-0000-0000-0000-000000000933',
    '{"identitySchemaVersion":2,"playerStates":{"00000000-0000-4000-8000-000000000935":{"hand":[]}}}'::jsonb,
    '00000000-0000-4000-8000-000000000935'
  );

set constraints all immediate;

select throws_ok(
  $$
    update public.rooms
    set host_seat_id = '00000000-0000-4000-8000-000000000935'
    where id = '00000000-0000-0000-0000-000000000932'
  $$,
  '23503',
  null,
  'a room cannot reference another room host seat'
);

select throws_ok(
  $$
    update public.game_states
    set current_seat_id = '00000000-0000-4000-8000-000000000935'
    where room_id = '00000000-0000-0000-0000-000000000932'
  $$,
  '23503',
  null,
  'game state cannot reference another room current seat'
);

select throws_ok(
  $$
    insert into public.game_history (
      room_id,
      action_type,
      actor_seat_id
    ) values (
      '00000000-0000-0000-0000-000000000932',
      'seat-identity-test',
      '00000000-0000-4000-8000-000000000935'
    )
  $$,
  '23503',
  null,
  'game history cannot reference another room actor seat'
);

select throws_ok(
  $$
    insert into public.active_room_memberships (
      user_id,
      room_id,
      seat_id,
      status,
      transition_id
    ) values (
      '00000000-0000-0000-0000-000000000931',
      '00000000-0000-0000-0000-000000000932',
      '00000000-0000-4000-8000-000000000935',
      'active',
      '00000000-0000-4000-8000-000000000936'
    )
  $$,
  '23503',
  null,
  'active membership cannot reference another room seat'
);

select throws_ok(
  $$
    update public.room_players
    set id = '00000000-0000-4000-8000-000000000937'
    where id = '00000000-0000-4000-8000-000000000934'
  $$,
  'PT422',
  null,
  'a seat UUID cannot change while its room exists'
);

select throws_ok(
  $$
    delete from public.room_players
    where id = '00000000-0000-4000-8000-000000000934'
  $$,
  'PT422',
  null,
  'a seat cannot be deleted independently from its room'
);

select throws_ok(
  $$
    select public.persist_room_roster_atomic(
      '00000000-0000-0000-0000-000000000932',
      '[{
        "seatId":"00000000-0000-4000-8000-000000000937",
        "name":"Replacement",
        "team":0,
        "isReady":true,
        "isCOM":false,
        "joinedAt":"2026-08-11T00:00:00.000Z",
        "seatIndex":0
      }]'::jsonb,
      '{"00000000-0000-4000-8000-000000000937":{"hand":[]}}'::jsonb,
      '00000000-0000-4000-8000-000000000937',
      0
    )
  $$,
  'PT422',
  null,
  'roster persistence cannot replace the UUID assigned to a seat index'
);

select public.persist_room_roster_atomic(
  '00000000-0000-0000-0000-000000000932',
  '[{
    "seatId":"00000000-0000-4000-8000-000000000934",
    "name":"COM",
    "team":0,
    "isReady":true,
    "isCOM":true,
    "joinedAt":"2026-08-11T00:00:00.000Z",
    "seatIndex":0
  }]'::jsonb,
  '{"00000000-0000-4000-8000-000000000934":{"hand":["S1"]}}'::jsonb,
  '00000000-0000-4000-8000-000000000934',
  0
);

select is(
  (
    select id
    from public.room_players
    where room_id = '00000000-0000-0000-0000-000000000932'
      and seat_index = 0
  ),
  '00000000-0000-4000-8000-000000000934'::uuid,
  'human to COM replacement preserves the seat UUID'
);

select public.atomic_update_game_state(
  '00000000-0000-0000-0000-000000000932',
  '{
    "roundState": {
      "winnerId": "00000000-0000-4000-8000-000000000934",
      "turn": {
        "playerId": "00000000-0000-4000-8000-000000000934"
      },
      "playedBy": ["00000000-0000-4000-8000-000000000934"]
    }
  }'::jsonb,
  '{}'::jsonb,
  1
);

select ok(
  not (
    select
      jsonb_path_exists(state_data, '$.**.playerId')
      or jsonb_path_exists(state_data, '$.**.winnerId')
      or jsonb_path_exists(state_data, '$.**.playedBy')
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000932'
  ),
  'state persistence recursively removes legacy identity aliases'
);

select is(
  (
    select state_data->'roundState'
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000932'
  ),
  '{
    "winnerSeatId":"00000000-0000-4000-8000-000000000934",
    "turn":{"seatId":"00000000-0000-4000-8000-000000000934"},
    "playedBySeatIds":["00000000-0000-4000-8000-000000000934"]
  }'::jsonb,
  'state persistence keeps the canonical nested identity fields'
);

select is(
  (
    select state_data->>'identitySchemaVersion'
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000932'
  ),
  '2',
  'state persistence always writes identity schema version 2'
);

select throws_ok(
  $$
    select public.atomic_update_game_state(
      '00000000-0000-0000-0000-000000000932',
      '{"roundState":{"winnerSeatId":"00000000-0000-4000-8000-000000000935"}}'::jsonb,
      '{}'::jsonb,
      2
    )
  $$,
  'PT422',
  null,
  'state updates reject nested seat references from another room'
);

select throws_ok(
  $$
    select public.persist_room_roster_atomic(
      '00000000-0000-0000-0000-000000000932',
      '[{
        "seatId":"00000000-0000-4000-8000-000000000934",
        "name":"Should roll back",
        "team":1,
        "isReady":false,
        "isCOM":false,
        "joinedAt":"2026-08-11T00:00:00.000Z",
        "seatIndex":0
      }]'::jsonb,
      '{"00000000-0000-4000-8000-000000000934":{"hand":["H2"]}}'::jsonb,
      '00000000-0000-4000-8000-000000000934',
      2,
      '{"deck":["H2"]}'::jsonb,
      '{"gamePhase":"invalid-phase"}'::jsonb
    )
  $$,
  '22P02',
  null,
  'a late roster RPC failure aborts the transaction'
);

select is(
  (
    select jsonb_build_object(
      'name', name,
      'team', team,
      'isCOM', is_com
    )
    from public.room_players
    where id = '00000000-0000-4000-8000-000000000934'
  ),
  '{"name":"COM","team":0,"isCOM":true}'::jsonb,
  'a late roster RPC failure rolls back the room player update'
);

select is(
  (
    select jsonb_build_object(
      'version', version,
      'playerStates', state_data->'playerStates',
      'deck', state_data->'deck'
    )
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000932'
  ),
  '{
    "version":2,
    "playerStates":{"00000000-0000-4000-8000-000000000934":{"hand":["S1"]}},
    "deck":null
  }'::jsonb,
  'a late roster RPC failure leaves game state unchanged'
);

select is(
  (
    select array_agg(
      table_name || '.' || column_name
      order by table_name, column_name
    )
    from information_schema.columns
    where table_schema in ('public', 'meitra_private')
      and column_name like '%\_id' escape '\'
      and data_type <> 'uuid'
  ),
  array[
    'push_receipts.device_id',
    'push_receipts.expo_receipt_id',
    'push_receipts.worker_id',
    'push_tokens.device_id'
  ]::text[],
  'only approved external opaque identifiers use non-UUID *_id columns'
);

select * from finish();

rollback;
