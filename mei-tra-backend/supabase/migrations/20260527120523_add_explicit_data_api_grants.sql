-- Supabase no longer exposes new public tables to the Data API by default.
-- Keep these grants explicit so fresh projects and future resets work through
-- PostgREST / supabase-js without relying on legacy default privileges.

grant select, insert, update, delete on table
  public.rooms,
  public.room_players,
  public.game_states,
  public.game_history,
  public.user_profiles,
  public.chat_rooms,
  public.chat_members,
  public.chat_messages
to service_role;

grant usage, select on all sequences in schema public to service_role;

-- Browser clients read public profiles directly during auth/profile loading.
grant select on table public.user_profiles to anon, authenticated;
grant insert, update on table public.user_profiles to authenticated;

-- Chat RLS policies allow public room discovery and authenticated message reads.
grant select on table public.chat_rooms to anon, authenticated;
grant select on table public.chat_members to authenticated;
grant select on table public.chat_messages to authenticated;

notify pgrst, 'reload schema';
