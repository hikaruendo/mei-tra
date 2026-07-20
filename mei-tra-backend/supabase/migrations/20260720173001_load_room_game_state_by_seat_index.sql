create or replace function public.load_room_game_state(p_room_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'gameState', to_jsonb(game_state),
    'roomPlayers', coalesce(
      (
        select jsonb_agg(to_jsonb(room_player) order by room_player.seat_index)
        from public.room_players as room_player
        where room_player.room_id = p_room_id
      ),
      '[]'::jsonb
    )
  )
  from public.game_states as game_state
  where game_state.room_id = p_room_id;
$$;
