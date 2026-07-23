begin;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.atomic_update_game_state(uuid,jsonb,jsonb,bigint)',
    'execute'
  ) then
    raise exception 'anon can execute atomic_update_game_state';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.persist_room_roster_atomic(uuid,jsonb,jsonb,jsonb,text,bigint)',
    'execute'
  ) then
    raise exception 'service_role cannot execute persist_room_roster_atomic';
  end if;
end;
$$;

insert into public.rooms (id, name, host_id)
values (
  '00000000-0000-0000-0000-000000000901',
  'Atomic persistence test',
  'player-old'
);

insert into public.game_states (room_id, state_data)
values (
  '00000000-0000-0000-0000-000000000901',
  '{"players": [], "playerStates": {}, "playerOrder": []}'::jsonb
);

insert into public.room_players (
  room_id,
  player_id,
  name,
  team,
  is_host,
  seat_index
)
values (
  '00000000-0000-0000-0000-000000000901',
  'player-old',
  'Old player',
  0,
  true,
  0
);

do $$
declare
  persisted_version bigint;
begin
  begin
    perform public.persist_room_roster_atomic(
      '00000000-0000-0000-0000-000000000901',
      '[{"playerId":"player-new","name":"New player","isReady":true,"isHost":true,"isCOM":false}]'::jsonb,
      '{"player-new":{"hand":[],"isPasser":false,"hasBroken":false,"hasRequiredBroken":false}}'::jsonb,
      '["player-new"]'::jsonb,
      'player-new',
      0
    );
    raise exception 'Expected invalid roster write to fail';
  exception
    when not_null_violation then null;
  end;

  if not exists (
    select 1
    from public.room_players
    where room_id = '00000000-0000-0000-0000-000000000901'
      and player_id = 'player-old'
  ) then
    raise exception 'Failed roster write removed the existing player';
  end if;

  select version
  into persisted_version
  from public.game_states
  where room_id = '00000000-0000-0000-0000-000000000901';

  if persisted_version <> 0 then
    raise exception 'Failed roster write changed the game state version';
  end if;
end;
$$;

select public.persist_room_roster_atomic(
  '00000000-0000-0000-0000-000000000901',
  '[{"playerId":"player-new","name":"New player","team":1,"isReady":true,"isHost":true,"isCOM":false,"joinedAt":"2026-07-19T00:00:00.000Z","seatIndex":0}]'::jsonb,
  '{"player-new":{"hand":["S1"],"isPasser":true,"hasBroken":true,"hasRequiredBroken":false}}'::jsonb,
  '["player-new"]'::jsonb,
  'player-new',
  0
);

do $$
declare
  persisted_player public.room_players%rowtype;
  persisted_state public.game_states%rowtype;
begin
  select *
  into persisted_player
  from public.room_players
  where room_id = '00000000-0000-0000-0000-000000000901';

  if persisted_player.player_id <> 'player-new'
    or persisted_player.socket_id is not null
    or persisted_player.team <> 1
    or persisted_player.seat_index <> 0 then
    raise exception 'Valid roster write did not persist the expected player';
  end if;

  select *
  into persisted_state
  from public.game_states
  where room_id = '00000000-0000-0000-0000-000000000901';

  if persisted_state.version <> 1
    or persisted_state.state_data->'playerOrder' <> '["player-new"]'::jsonb
    or persisted_state.state_data->'playerStates'->'player-new'->'hand'
      <> '["S1"]'::jsonb then
    raise exception 'Valid roster write did not persist the expected game state';
  end if;
end;
$$;

select public.atomic_update_game_state(
  '00000000-0000-0000-0000-000000000901',
  '{}'::jsonb,
  '{"roundNumber":2}'::jsonb,
  1
);

do $$
declare
  persisted_state public.game_states%rowtype;
begin
  begin
    perform public.atomic_update_game_state(
      '00000000-0000-0000-0000-000000000901',
      '{}'::jsonb,
      '{"roundNumber":3}'::jsonb,
      1
    );
    raise exception 'Expected stale version write to fail';
  exception
    when sqlstate 'PT409' then null;
  end;

  select *
  into persisted_state
  from public.game_states
  where room_id = '00000000-0000-0000-0000-000000000901';

  if persisted_state.version <> 2 or persisted_state.round_number <> 2 then
    raise exception 'Stale version write changed the game state';
  end if;
end;
$$;

rollback;
