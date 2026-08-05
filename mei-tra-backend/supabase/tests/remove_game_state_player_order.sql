begin;

select plan(8);

insert into public.rooms (id, name, host_id)
values (
  '00000000-0000-0000-0000-000000000904',
  'Remove playerOrder test',
  'player-1'
);

insert into public.game_states (
  room_id,
  state_data,
  current_player_id,
  current_player_index
)
values (
  '00000000-0000-0000-0000-000000000904',
  '{"playerStates":{},"playerOrder":["player-2","player-1"],"deck":[]}'::jsonb,
  'player-1',
  0
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
    '00000000-0000-0000-0000-000000000904',
    'player-1',
    'Player 1',
    0,
    true,
    false,
    0
  ),
  (
    '00000000-0000-0000-0000-000000000904',
    'player-2',
    'Player 2',
    1,
    false,
    false,
    1
  );

select public.persist_room_roster_atomic(
  '00000000-0000-0000-0000-000000000904',
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
  '{
    "com-1":{"hand":["S1"]},
    "player-2":{"hand":["H2"]}
  }'::jsonb,
  'com-1',
  0
);

select is(
  (
    select current_player_id
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000904'
  ),
  'com-1'::text,
  'seat replacement remaps current_player_id'
);

select is(
  (
    select current_player_index
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000904'
  ),
  0,
  'seat replacement preserves the turn index'
);

select ok(
  not (
    select state_data ? 'playerOrder'
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000904'
  ),
  'new roster RPC does not persist playerOrder'
);

select public.atomic_update_game_state(
  '00000000-0000-0000-0000-000000000904',
  '{"playerOrder":["player-2","com-1"],"deck":["D3"]}'::jsonb,
  '{"currentPlayerIndex":1}'::jsonb,
  1
);

select is(
  (
    select current_player_id
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000904'
  ),
  'player-2'::text,
  'index-only compatibility writes derive current_player_id from seat order'
);

select is(
  (
    select state_data->'deck'
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000904'
  ),
  '["D3"]'::jsonb,
  'atomic updates preserve non-playerOrder state patches'
);

select ok(
  not (
    select state_data ? 'playerOrder'
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000904'
  ),
  'atomic updates reject playerOrder patches'
);

select public.persist_room_roster_atomic(
  '00000000-0000-0000-0000-000000000904',
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
  '{"com-1":{},"player-2":{}}'::jsonb,
  '["player-2","com-1"]'::jsonb,
  'com-1',
  2
);

select ok(
  not (
    select state_data ? 'playerOrder'
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000904'
  ),
  'legacy roster RPC remains callable without restoring playerOrder'
);

select is(
  (
    select state_data->'playerStates'->'com-1'
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000904'
  ),
  '{}'::jsonb,
  'legacy roster RPC still persists playerStates'
);

select * from finish();

rollback;
