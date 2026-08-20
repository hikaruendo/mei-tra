create or replace function meitra_private.resolve_room_seat_id(
  p_room_id uuid,
  p_identity_key text default null,
  p_user_id uuid default null
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  resolved_seat_id uuid;
  legacy_user_id uuid;
  timeout_seat_index integer;
  alias_first_seen_at timestamptz;
begin
  select room_player.id
  into resolved_seat_id
  from public.room_players as room_player
  where room_player.room_id = p_room_id
    and (
      (p_identity_key is not null and room_player.id::text = p_identity_key)
      or (
        p_identity_key is not null
        and room_player.player_id = p_identity_key
      )
      or (p_user_id is not null and room_player.user_id = p_user_id)
    )
  order by case
    when p_identity_key is not null
      and room_player.id::text = p_identity_key then 0
    when p_identity_key is not null
      and room_player.player_id = p_identity_key then 1
    else 2
  end
  limit 1;

  if resolved_seat_id is not null then
    return resolved_seat_id;
  end if;

  if p_identity_key ~ '^com-timeout-[0-9]+-[0-9]+$' then
    timeout_seat_index := substring(
      p_identity_key from '^com-timeout-([0-9]+)-'
    )::integer;

    select room_player.id
    into resolved_seat_id
    from public.room_players as room_player
    where room_player.room_id = p_room_id
      and room_player.seat_index = timeout_seat_index
    limit 1;

    if resolved_seat_id is not null then
      return resolved_seat_id;
    end if;
  end if;

  legacy_user_id := p_user_id;

  if legacy_user_id is null and p_identity_key is not null then
    begin
      legacy_user_id := p_identity_key::uuid;
    exception when invalid_text_representation then
      legacy_user_id := null;
    end;
  end if;

  if legacy_user_id is not null then
    select event.seat_id
    into resolved_seat_id
    from public.room_membership_events as event
    where event.user_id = legacy_user_id
      and event.seat_id is not null
      and (
        event.from_room_id = p_room_id
        or event.to_room_id = p_room_id
      )
    order by event.created_at desc
    limit 1;

    if resolved_seat_id is not null then
      return resolved_seat_id;
    end if;
  end if;

  select room.host_seat_id
  into resolved_seat_id
  from public.rooms as room
  where room.id = p_room_id
    and room.host_seat_id is not null
    and (
      room.host_id = p_identity_key
      or room.host_id = legacy_user_id::text
    )
  limit 1;

  if resolved_seat_id is not null then
    return resolved_seat_id;
  end if;

  if p_identity_key ~ '^com-left-[0-9]+$' then
    select min(history.timestamp)
    into alias_first_seen_at
    from public.game_history as history
    where history.room_id = p_room_id
      and history.player_id = p_identity_key;

    select event.seat_id
    into resolved_seat_id
    from public.room_membership_events as event
    where event.seat_id is not null
      and (
        event.from_room_id = p_room_id
        or event.to_room_id = p_room_id
      )
      and event.event_type in (
        'player_membership_released',
        'disconnect_timeout_completed',
        'room_left',
        'room_closed'
      )
      and (
        alias_first_seen_at is null
        or event.created_at <= alias_first_seen_at
      )
    order by event.created_at desc
    limit 1;

    if resolved_seat_id is not null then
      return resolved_seat_id;
    end if;
  end if;

  return null;
end;
$function$;

revoke all on function meitra_private.resolve_room_seat_id(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function meitra_private.resolve_room_seat_id(uuid, text, uuid)
  to service_role;

with host_candidates as (
  select distinct on (room_player.room_id)
    room_player.room_id,
    room_player.id as seat_id
  from public.room_players as room_player
  order by
    room_player.room_id,
    room_player.is_host desc,
    room_player.seat_index,
    room_player.joined_at
)
update public.rooms as room
set host_seat_id = host_candidates.seat_id
from host_candidates
where room.id = host_candidates.room_id
  and room.host_seat_id is null;

update public.game_history as history
set
  actor_key_snapshot = coalesce(
    history.actor_key_snapshot,
    history.player_id
  ),
  actor_seat_id = meitra_private.resolve_room_seat_id(
    history.room_id,
    history.player_id,
    null
  )
where history.actor_seat_id is null
  and history.player_id is not null;
