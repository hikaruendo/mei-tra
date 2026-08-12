begin;

select plan(13);

select ok(
  not has_function_privilege(
    'anon',
    'public.atomic_update_game_state(uuid,jsonb,jsonb,bigint)',
    'execute'
  ),
  'anonymous clients cannot update game state'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.persist_room_roster_atomic(uuid,jsonb,jsonb,text,bigint,jsonb,jsonb,jsonb)',
    'execute'
  ),
  'the backend can persist room rosters'
);

select has_column(
  'public',
  'game_states',
  'current_seat_id',
  'game_states persists the current seat UUID'
);

select hasnt_column(
  'public',
  'game_states',
  'current_player_id',
  'the legacy current_player_id column is removed'
);

select hasnt_column(
  'public',
  'game_states',
  'current_player_index',
  'current_player_index is removed'
);

select ok(
  to_regprocedure(
    'public.persist_room_roster_atomic(uuid,jsonb,jsonb,text,bigint,jsonb,jsonb,jsonb)'
  ) is not null,
  'the canonical roster RPC exists'
);

select ok(
  to_regprocedure(
    'public.persist_room_roster_atomic(uuid,jsonb,jsonb,text,bigint)'
  ) is null,
  'the legacy roster RPC overload is removed'
);

insert into public.rooms (id, name, host_seat_id)
values (
  '00000000-0000-0000-0000-000000000906',
  'Current seat identity test',
  '00000000-0000-4000-8000-000000000907'
);

insert into public.room_players (
  id,
  room_id,
  name,
  team,
  is_com,
  seat_index
)
values
  (
    '00000000-0000-4000-8000-000000000907',
    '00000000-0000-0000-0000-000000000906',
    'Player 1',
    0,
    false,
    0
  ),
  (
    '00000000-0000-4000-8000-000000000908',
    '00000000-0000-0000-0000-000000000906',
    'Player 2',
    1,
    false,
    1
  );

insert into public.game_states (
  room_id,
  state_data,
  current_seat_id
)
values (
  '00000000-0000-0000-0000-000000000906',
  '{
    "identitySchemaVersion": 2,
    "playerStates": {
      "00000000-0000-4000-8000-000000000907": {"hand": []},
      "00000000-0000-4000-8000-000000000908": {"hand": []}
    }
  }'::jsonb,
  '00000000-0000-4000-8000-000000000907'
);

select public.persist_room_roster_atomic(
  '00000000-0000-0000-0000-000000000906',
  '[
    {
      "seatId":"00000000-0000-4000-8000-000000000907",
      "name":"COM",
      "team":0,
      "isReady":true,
      "isCOM":true,
      "joinedAt":"2026-08-05T00:00:00.000Z",
      "seatIndex":0
    },
    {
      "seatId":"00000000-0000-4000-8000-000000000908",
      "name":"Player 2",
      "team":1,
      "isReady":true,
      "isCOM":false,
      "joinedAt":"2026-08-05T00:00:00.000Z",
      "seatIndex":1
    }
  ]'::jsonb,
  '{
    "00000000-0000-4000-8000-000000000907":{"hand":["S1"]},
    "00000000-0000-4000-8000-000000000908":{"hand":["H2"]}
  }'::jsonb,
  '00000000-0000-4000-8000-000000000907',
  0
);

select is(
  (
    select current_seat_id
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000906'
  ),
  '00000000-0000-4000-8000-000000000907'::uuid,
  'a COM replacement keeps the current turn on the same seat'
);

select ok(
  not (
    select state_data ?| array['players', 'playerOrder', 'teamAssignments']
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000906'
  ),
  'roster persistence removes legacy state keys'
);

select public.atomic_update_game_state(
  '00000000-0000-0000-0000-000000000906',
  '{"playerOrder":[],"deck":["D3"]}'::jsonb,
  '{"currentSeatId":"00000000-0000-4000-8000-000000000908"}'::jsonb,
  1
);

select is(
  (
    select current_seat_id
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000906'
  ),
  '00000000-0000-4000-8000-000000000908'::uuid,
  'turn updates persist the canonical seat UUID'
);

select is(
  (
    select state_data->'deck'
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000906'
  ),
  '["D3"]'::jsonb,
  'atomic updates preserve regular state patches'
);

select throws_ok(
  $$
    select public.atomic_update_game_state(
      '00000000-0000-0000-0000-000000000906',
      '{}'::jsonb,
      '{"currentSeatId":"00000000-0000-4000-8000-000000000909"}'::jsonb,
      2
    )
  $$,
  'PT422',
  null,
  'turn updates reject seats outside the room'
);

select throws_ok(
  $$
    select public.atomic_update_game_state(
      '00000000-0000-0000-0000-000000000906',
      '{}'::jsonb,
      '{"roundNumber":3}'::jsonb,
      1
    )
  $$,
  'PT409',
  null,
  'stale versions cannot overwrite game state'
);

select * from finish();

rollback;
