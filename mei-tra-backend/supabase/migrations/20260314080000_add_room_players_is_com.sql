alter table public.room_players
  add column if not exists is_com boolean not null default false;

notify pgrst, 'reload schema';
