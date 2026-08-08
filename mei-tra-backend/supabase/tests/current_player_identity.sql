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
    'public.persist_room_roster_atomic(uuid,jsonb,jsonb,text,bigint)',
    'execute'
  ),
  'the backend can persist room rosters'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'game_states'
      and column_name = 'current_player_id'
  ),
  'game_states persists the current player id'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'game_states'
      and column_name = 'current_player_index'
  ),
  'current_player_index is removed'
);

select ok(
  to_regprocedure(
    'public.persist_room_roster_atomic(uuid,jsonb,jsonb,text,bigint)'
  ) is not null,
  'the canonical roster RPC exists'
);

select ok(
  to_regprocedure(
    'public.persist_room_roster_atomic(uuid,jsonb,jsonb,jsonb,text,bigint)'
  ) is null,
  'the playerOrder roster RPC is removed'
);

insert into public.rooms (id, name, host_id)
values (
  '00000000-0000-0000-0000-000000000906',
  'Current player identity test',
  'player-1'
);

insert into public.game_states (
  room_id,
  state_data,
  current_player_id
)
values (
  '00000000-0000-0000-0000-000000000906',
  '{"playerStates":{},"playerOrder":["player-2","player-1"]}'::jsonb,
  'player-1'
);

insert into public.room_players (
  room_id,
  player_id,
  name,
  team,
  is_host,
  is_com,
  seat_index
)
values
  (
    '00000000-0000-0000-0000-000000000906',
    'player-1',
    'Player 1',
    0,
    true,
    false,
    0
  ),
  (
    '00000000-0000-0000-0000-000000000906',
    'player-2',
    'Player 2',
    1,
    false,
    false,
    1
  );

select public.persist_room_roster_atomic(
  '00000000-0000-0000-0000-000000000906',
  '[
    {
      "playerId":"com-1",
      "name":"COM",
      "team":0,
      "isReady":true,
      "isHost":true,
      "isCOM":true,
      "joinedAt":"2026-08-05T00:00:00.000Z",
      "seatIndex":0
    },
    {
      "playerId":"player-2",
      "name":"Player 2",
      "team":1,
      "isReady":true,
      "isHost":false,
      "isCOM":false,
      "joinedAt":"2026-08-05T00:00:00.000Z",
      "seatIndex":1
    }
  ]'::jsonb,
  '{"com-1":{"hand":["S1"]},"player-2":{"hand":["H2"]}}'::jsonb,
  'com-1',
  0
);

select is(
  (
    select current_player_id
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000906'
  ),
  'com-1'::text,
  'a COM replacement inherits the current turn by seat'
);

select ok(
  not (
    select state_data ? 'playerOrder'
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000906'
  ),
  'roster persistence removes playerOrder'
);

select public.atomic_update_game_state(
  '00000000-0000-0000-0000-000000000906',
  '{"playerOrder":["player-2","com-1"],"deck":["D3"]}'::jsonb,
  '{"currentPlayerId":"player-2"}'::jsonb,
  1
);

select is(
  (
    select current_player_id
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000906'
  ),
  'player-2'::text,
  'turn updates persist only the player id'
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

select ok(
  not (
    select state_data ? 'playerOrder'
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000906'
  ),
  'atomic updates reject playerOrder patches'
);

select throws_ok(
  $$
    select public.atomic_update_game_state(
      '00000000-0000-0000-0000-000000000906',
      '{}'::jsonb,
      '{"currentPlayerId":"missing-player"}'::jsonb,
      2
    )
  $$,
  'PT422',
  null,
  'turn updates reject players outside the room'
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
