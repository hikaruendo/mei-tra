create table public.game_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  seat_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  player_name_snapshot text not null,
  team_snapshot integer,
  joined_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  constraint game_participants_room_user_key unique (room_id, user_id),
  constraint game_participants_team_check check (
    team_snapshot is null or team_snapshot in (0, 1)
  )
);

create index game_participants_user_id_idx
  on public.game_participants (user_id, joined_at desc)
  where user_id is not null;

create index game_participants_room_id_idx
  on public.game_participants (room_id);

alter table public.game_participants enable row level security;

revoke all on table public.game_participants from anon, authenticated;

create or replace function meitra_private.capture_game_participant(
  requested_room_id uuid,
  requested_seat_id uuid,
  requested_user_id uuid,
  requested_player_name text,
  requested_team integer,
  requested_joined_at timestamp with time zone
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.game_participants (
    room_id,
    seat_id,
    user_id,
    player_name_snapshot,
    team_snapshot,
    joined_at
  )
  values (
    requested_room_id,
    requested_seat_id,
    requested_user_id,
    requested_player_name,
    requested_team,
    coalesce(requested_joined_at, now())
  )
  on conflict (room_id, user_id) do nothing;
$$;

revoke all on function meitra_private.capture_game_participant(
  uuid,
  uuid,
  uuid,
  text,
  integer,
  timestamp with time zone
) from public, anon, authenticated;

create or replace function meitra_private.capture_room_player_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_room_status text;
begin
  if new.user_id is null or new.room_id is null then
    return new;
  end if;

  select room.status::text
  into current_room_status
  from public.rooms as room
  where room.id = new.room_id;

  if current_room_status not in ('playing', 'finished') then
    return new;
  end if;

  perform meitra_private.capture_game_participant(
    new.room_id,
    new.id,
    new.user_id,
    new.name,
    new.team,
    new.joined_at
  );

  return new;
end;
$$;

revoke all on function meitra_private.capture_room_player_participant()
  from public, anon, authenticated;

create trigger capture_room_player_participant
after insert or update of room_id, user_id, name, team, joined_at
on public.room_players
for each row
execute function meitra_private.capture_room_player_participant();

create or replace function meitra_private.capture_room_participants_on_start()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant record;
begin
  if new.status::text <> 'playing' or old.status::text = 'playing' then
    return new;
  end if;

  for participant in
    select
      room_player.id,
      room_player.user_id,
      room_player.name,
      room_player.team,
      room_player.joined_at
    from public.room_players as room_player
    where room_player.room_id = new.id
      and room_player.user_id is not null
  loop
    perform meitra_private.capture_game_participant(
      new.id,
      participant.id,
      participant.user_id,
      participant.name,
      participant.team,
      participant.joined_at
    );
  end loop;

  return new;
end;
$$;

revoke all on function meitra_private.capture_room_participants_on_start()
  from public, anon, authenticated;

create trigger capture_room_participants_on_start
after update of status
on public.rooms
for each row
execute function meitra_private.capture_room_participants_on_start();

with participant_events as (
  select
    membership_event.to_room_id as room_id,
    membership_event.seat_id,
    membership_event.user_id,
    min(membership_event.created_at) as joined_at
  from public.room_membership_events as membership_event
  where membership_event.to_room_id is not null
    and membership_event.seat_id is not null
    and membership_event.user_id is not null
  group by
    membership_event.to_room_id,
    membership_event.seat_id,
    membership_event.user_id
),
participant_snapshots as (
  select
    participant_event.room_id,
    participant_event.seat_id,
    participant_event.user_id,
    coalesce(
      history_name.player_name,
      nullif(room_player.name, 'COM'),
      user_profile.display_name,
      user_profile.username,
      'Player'
    ) as player_name_snapshot,
    room_player.team as team_snapshot,
    participant_event.joined_at
  from participant_events as participant_event
  left join public.room_players as room_player
    on room_player.room_id = participant_event.room_id
   and room_player.id = participant_event.seat_id
  left join public.user_profiles as user_profile
    on user_profile.id = participant_event.user_id
  left join lateral (
    select
      history.action_data -> 'playerNames' ->> participant_event.seat_id::text
        as player_name
    from public.game_history as history
    where history.room_id = participant_event.room_id
      and history.action_data -> 'playerNames'
        ? participant_event.seat_id::text
    order by history.timestamp desc
    limit 1
  ) as history_name on true
)
insert into public.game_participants (
  room_id,
  seat_id,
  user_id,
  player_name_snapshot,
  team_snapshot,
  joined_at
)
select distinct on (room_id, user_id)
  room_id,
  seat_id,
  user_id,
  player_name_snapshot,
  team_snapshot,
  joined_at
from participant_snapshots
order by room_id, user_id, joined_at
on conflict (room_id, user_id) do nothing;

insert into public.game_participants (
  room_id,
  seat_id,
  user_id,
  player_name_snapshot,
  team_snapshot,
  joined_at
)
select
  room_player.room_id,
  room_player.id,
  room_player.user_id,
  room_player.name,
  room_player.team,
  coalesce(room_player.joined_at, now())
from public.room_players as room_player
join public.rooms as room on room.id = room_player.room_id
where room_player.user_id is not null
  and room.status::text in ('playing', 'finished')
on conflict (room_id, user_id) do nothing;
