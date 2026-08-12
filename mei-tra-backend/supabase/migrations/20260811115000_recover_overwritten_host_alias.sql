with legacy_host_actors as (
  select distinct on (history.room_id)
    history.room_id,
    history.actor_key_snapshot as legacy_host_identity,
    room.host_seat_id
  from public.game_history as history
  join public.rooms as room
    on room.id = history.room_id
  where history.action_type = 'game_started'
    and history.actor_seat_id is null
    and history.actor_key_snapshot
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and room.host_seat_id is not null
    and exists (
      select 1
      from public.room_membership_events as event
      where event.user_id = history.actor_key_snapshot::uuid
        and (
          event.from_room_id = history.room_id
          or event.to_room_id = history.room_id
        )
    )
  order by history.room_id, history.timestamp
)
update public.room_players as room_player
set player_id = legacy_host_actors.legacy_host_identity
from legacy_host_actors
where room_player.room_id = legacy_host_actors.room_id
  and room_player.id = legacy_host_actors.host_seat_id;

update public.game_history as history
set actor_seat_id = meitra_private.resolve_room_seat_id(
  history.room_id,
  history.actor_key_snapshot,
  null
)
where history.actor_seat_id is null
  and history.actor_key_snapshot is not null;
