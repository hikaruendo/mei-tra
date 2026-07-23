begin;

insert into public.rooms (id, name, host_id)
values (
  '00000000-0000-0000-0000-000000000902',
  'Legacy player cleanup test',
  'legacy-player-1'
);

insert into public.game_states (room_id, state_data)
values (
  '00000000-0000-0000-0000-000000000902',
  '{
    "players": [
      {
        "playerId": "legacy-player-1",
        "name": "Legacy Player 1",
        "team": 0,
        "hand": ["S1", "H2"],
        "isPasser": true,
        "hasBroken": true,
        "hasRequiredBroken": false
      }
    ],
    "playerStates": {
      "legacy-player-1": {
        "hand": ["S1", "H2"],
        "isPasser": true,
        "hasBroken": true,
        "hasRequiredBroken": false
      }
    },
    "playerOrder": ["legacy-player-1"]
  }'::jsonb
);

update public.game_states
set state_data = coalesce(state_data, '{}'::jsonb) - 'players'
where state_data ? 'players';

do $$
declare
  persisted_state public.game_states%rowtype;
begin
  select *
  into persisted_state
  from public.game_states
  where room_id = '00000000-0000-0000-0000-000000000902';

  if persisted_state.version <> 0 then
    raise exception 'Legacy cleanup changed the game state version';
  end if;

  if persisted_state.state_data ? 'players' then
    raise exception 'Legacy cleanup left state_data.players';
  end if;

  if persisted_state.state_data->'playerOrder'
    <> '["legacy-player-1"]'::jsonb then
    raise exception 'Legacy cleanup did not preserve playerOrder';
  end if;

  if persisted_state.state_data->'playerStates'->'legacy-player-1'
    <> '{
      "hand": ["S1", "H2"],
      "isPasser": true,
      "hasBroken": true,
      "hasRequiredBroken": false
    }'::jsonb then
    raise exception 'Legacy cleanup did not preserve playerStates';
  end if;
end;
$$;

rollback;
