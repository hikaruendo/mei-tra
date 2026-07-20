do $$
begin
  execute 'revoke all on function public.atomic_update_game_state(uuid, jsonb, jsonb, bigint) from public, anon, authenticated';
  execute 'revoke all on function public.persist_room_roster_atomic(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text, bigint) from public, anon, authenticated';
  execute 'revoke all on function public.load_room_game_state(uuid) from public, anon, authenticated';
  execute 'grant execute on function public.atomic_update_game_state(uuid, jsonb, jsonb, bigint) to service_role';
  execute 'grant execute on function public.persist_room_roster_atomic(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text, bigint) to service_role';
  execute 'grant execute on function public.load_room_game_state(uuid) to service_role';
  perform pg_notify('pgrst', 'reload schema');
end;
$$;
