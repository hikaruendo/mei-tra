begin;

insert into public.rooms (id, name, host_id)
values (
  '00000000-0000-0000-0000-000000000902',
  'Legacy player backfill test',
  'legacy-player-1'
);

insert into public.game_states (room_id, state_data, team_assignments)
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
      },
      {
        "playerId": "legacy-player-2",
        "name": "Legacy Player 2",
        "team": 1,
        "hand": ["D3"],
        "isPasser": false
      }
    ]
  }'::jsonb,
  '{"legacy-player-1": 0, "legacy-player-2": 1}'::jsonb
);

\ir ../migrations/20260719124824_atomic_room_state_persistence.sql

do $$
declare
  persisted_state public.game_states%rowtype;
begin
  select *
  into persisted_state
  from public.game_states
  where room_id = '00000000-0000-0000-0000-000000000902';

  if persisted_state.version <> 0 then
    raise exception 'Backfill changed the game state version';
  end if;

  if persisted_state.state_data->'playerOrder'
    <> '["legacy-player-1", "legacy-player-2"]'::jsonb then
    raise exception 'Backfill did not preserve legacy player order';
  end if;

  if persisted_state.state_data->'playerStates'->'legacy-player-1'
    <> '{
      "hand": ["S1", "H2"],
      "isPasser": true,
      "hasBroken": true,
      "hasRequiredBroken": false
    }'::jsonb then
    raise exception 'Backfill did not preserve the first player gameplay state';
  end if;

  if persisted_state.state_data->'playerStates'->'legacy-player-2'
    <> '{
      "hand": ["D3"],
      "isPasser": false,
      "hasBroken": false,
      "hasRequiredBroken": false
    }'::jsonb then
    raise exception 'Backfill did not supply defaults for legacy flags';
  end if;
end;
$$;

rollback;
