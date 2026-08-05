begin;

select plan(6);

insert into public.rooms (id, name, host_id)
values (
  '00000000-0000-0000-0000-000000000905',
  'Current player id test',
  'player-1'
);

insert into public.game_states (
  room_id,
  state_data,
  current_player_id,
  current_player_index
)
values (
  '00000000-0000-0000-0000-000000000905',
  '{"playerStates":{},"playerOrder":["player-2","player-1"]}'::jsonb,
  null,
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
    '00000000-0000-0000-0000-000000000905',
    'player-1',
    'Player 1',
    0,
    true,
    false,
    0
  ),
  (
    '00000000-0000-0000-0000-000000000905',
    'player-2',
    'Player 2',
    1,
    false,
    false,
    1
  );

select public.atomic_update_game_state(
  '00000000-0000-0000-0000-000000000905',
  '{}'::jsonb,
  '{"currentPlayerIndex":0}'::jsonb,
  0
);

select is(
  (
    select current_player_id
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000905'
  ),
  'player-2'::text,
  'legacy currentPlayerIndex writes update current_player_id'
);

select is(
  (
    select current_player_index
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000905'
  ),
  0,
  'legacy currentPlayerIndex writes preserve the requested index'
);

select public.atomic_update_game_state(
  '00000000-0000-0000-0000-000000000905',
  '{}'::jsonb,
  '{"currentPlayerId":"player-1","currentPlayerIndex":0}'::jsonb,
  1
);

select is(
  (
    select current_player_id
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000905'
  ),
  'player-1'::text,
  'currentPlayerId writes preserve the requested player'
);

select is(
  (
    select current_player_index
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000905'
  ),
  1,
  'currentPlayerId writes derive the compatibility index from playerOrder'
);

select public.persist_room_roster_atomic(
  '00000000-0000-0000-0000-000000000905',
  '[
    {
      "playerId":"player-2",
      "name":"Player 2",
      "team":1,
      "isReady":true,
      "isHost":false,
      "isCOM":false,
      "joinedAt":"2026-08-05T00:00:00.000Z",
      "seatIndex":1
    },
    {
      "playerId":"com-1",
      "name":"COM",
      "team":0,
      "isReady":true,
      "isHost":true,
      "isCOM":true,
      "joinedAt":"2026-08-05T00:00:00.000Z",
      "seatIndex":0
    }
  ]'::jsonb,
  '{"player-2":{},"com-1":{}}'::jsonb,
  '["player-2","com-1"]'::jsonb,
  'com-1',
  2
);

select is(
  (
    select current_player_id
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000905'
  ),
  'com-1'::text,
  'roster replacement remaps current_player_id at the same turn position'
);

select is(
  (
    select current_player_index
    from public.game_states
    where room_id = '00000000-0000-0000-0000-000000000905'
  ),
  1,
  'roster replacement preserves the current turn position'
);

select * from finish();

rollback;
