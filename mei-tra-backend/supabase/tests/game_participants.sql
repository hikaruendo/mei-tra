begin;

select plan(11);

select has_table(
  'public',
  'game_participants',
  'game participants are stored independently from the mutable room roster'
);

select col_type_is(
  'public',
  'game_participants',
  'seat_id',
  'uuid',
  'game participant seats use canonical UUIDs'
);

select ok(
  not has_table_privilege('authenticated', 'public.game_participants', 'select'),
  'authenticated clients cannot read game participants directly'
);

insert into auth.users (
  id,
  email,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000008801',
  'game-participant@example.com',
  '{"username":"game_participant","display_name":"Game Participant"}'::jsonb,
  now(),
  now()
);

insert into public.rooms (id, name)
values (
  '00000000-0000-0000-0000-000000008802',
  'Game participant room'
);

insert into public.room_players (
  id,
  room_id,
  user_id,
  name,
  team,
  is_com,
  seat_index
)
values (
  '00000000-0000-4000-8000-000000008803',
  '00000000-0000-0000-0000-000000008802',
  '00000000-0000-0000-0000-000000008801',
  'Mobile Player',
  1,
  false,
  0
);

select is(
  (
    select count(*)
    from public.game_participants
    where room_id = '00000000-0000-0000-0000-000000008802'
  ),
  0::bigint,
  'waiting-room roster changes do not create match participants'
);

update public.rooms
set status = 'playing'
where id = '00000000-0000-0000-0000-000000008802';

select is(
  (
    select user_id
    from public.game_participants
    where room_id = '00000000-0000-0000-0000-000000008802'
  ),
  '00000000-0000-0000-0000-000000008801'::uuid,
  'starting a game captures the authenticated participant'
);

select is(
  (
    select seat_id
    from public.game_participants
    where room_id = '00000000-0000-0000-0000-000000008802'
  ),
  '00000000-0000-4000-8000-000000008803'::uuid,
  'the participant snapshot keeps the canonical seat UUID'
);

select is(
  (
    select player_name_snapshot
    from public.game_participants
    where room_id = '00000000-0000-0000-0000-000000008802'
  ),
  'Mobile Player',
  'the participant snapshot keeps the player name'
);

update public.room_players
set user_id = null,
    name = 'COM',
    is_com = true
where room_id = '00000000-0000-0000-0000-000000008802'
  and id = '00000000-0000-4000-8000-000000008803';

select is(
  (
    select user_id
    from public.game_participants
    where room_id = '00000000-0000-0000-0000-000000008802'
  ),
  '00000000-0000-0000-0000-000000008801'::uuid,
  'COM replacement does not erase the historical user association'
);

select is(
  (
    select player_name_snapshot
    from public.game_participants
    where room_id = '00000000-0000-0000-0000-000000008802'
  ),
  'Mobile Player',
  'COM replacement does not overwrite the historical player name'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'capture_room_participants_on_start'
      and not tgisinternal
  ),
  'the game-start participant trigger is installed'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'capture_room_player_participant'
      and not tgisinternal
  ),
  'the in-game roster participant trigger is installed'
);

select * from finish();

rollback;
