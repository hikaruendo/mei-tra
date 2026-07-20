alter table public.game_states
  add column if not exists version bigint not null default 0;

update public.game_states as game_state
set state_data = coalesce(game_state.state_data, '{}'::jsonb) || jsonb_build_object(
  'playerStates',
  coalesce(
    game_state.state_data->'playerStates',
    (
      select jsonb_object_agg(
        player->>'playerId',
        jsonb_build_object(
          'hand', coalesce(player->'hand', '[]'::jsonb),
          'isPasser', coalesce((player->>'isPasser')::boolean, false),
          'hasBroken', coalesce((player->>'hasBroken')::boolean, false),
          'hasRequiredBroken',
            coalesce((player->>'hasRequiredBroken')::boolean, false)
        )
      )
      from jsonb_array_elements(
        coalesce(game_state.state_data->'players', '[]'::jsonb)
      ) as player
      where player ? 'playerId'
    ),
    '{}'::jsonb
  ),
  'playerOrder',
  coalesce(
    game_state.state_data->'playerOrder',
    (
      select jsonb_agg(player->>'playerId' order by ordinality)
      from jsonb_array_elements(
        coalesce(game_state.state_data->'players', '[]'::jsonb)
      ) with ordinality as player_entry(player, ordinality)
      where player ? 'playerId'
    ),
    '[]'::jsonb
  )
);
