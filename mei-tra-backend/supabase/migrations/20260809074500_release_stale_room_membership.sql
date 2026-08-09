-- A membership is supposed to be released when its room finishes, but that
-- release is a second step after the room status write (see
-- RoomService.updateRoomStatus). If the process dies between the two, or the
-- release RPC fails, the row survives pointing at a room nobody can join --
-- and reserve/claim then reject every future room for that user forever.
--
-- Rather than making the two writes atomic (the status write lives behind the
-- repository, and abandoned rooms have other producers), treat the membership
-- itself as authoritative only while its room is still joinable: a membership
-- whose room is 'finished' or 'abandoned' is dead and gets cleared on the spot
-- by whichever reserve/claim runs next. That also drains rows already stranded
-- by past crashes without a data migration.

create or replace function public.release_stale_room_membership(
  p_membership public.active_room_memberships,
  p_transition_id uuid
)
returns boolean
language plpgsql
set search_path to ''
as $function$
declare
  stale_room_status public.room_status;
begin
  if p_membership.room_id is null then
    return false;
  end if;

  select rooms.status
  into stale_room_status
  from public.rooms
  where rooms.id = p_membership.room_id;

  -- Deleting a room cascades its memberships away, so a missing room normally
  -- cannot strand anyone; it is treated as stale here purely defensively.
  if found and stale_room_status not in ('finished', 'abandoned') then
    return false;
  end if;

  delete from public.active_room_memberships
  where user_id = p_membership.user_id
    and membership_version = p_membership.membership_version;

  if not found then
    return false;
  end if;

  insert into public.room_membership_events (
    transition_id,
    user_id,
    from_room_id,
    event_type,
    membership_version,
    metadata
  ) values (
    p_transition_id,
    p_membership.user_id,
    p_membership.room_id,
    'stale_room_released',
    p_membership.membership_version,
    jsonb_build_object('roomStatus', stale_room_status)
  );

  return true;
end;
$function$;

create or replace function public.reserve_room_membership(
  p_user_id uuid,
  p_player_id text,
  p_transition_id uuid
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  current_membership public.active_room_memberships%rowtype;
  has_membership boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select *
  into current_membership
  from public.active_room_memberships
  where user_id = p_user_id
  for update;

  has_membership := found;

  if has_membership
    and public.release_stale_room_membership(
      current_membership,
      p_transition_id
    ) then
    has_membership := false;
  end if;

  if not has_membership then
    insert into public.active_room_memberships (
      user_id,
      room_id,
      player_id,
      status,
      membership_version,
      transition_id
    ) values (
      p_user_id,
      null,
      p_player_id,
      'moving',
      1,
      p_transition_id
    )
    returning * into current_membership;

    insert into public.room_membership_events (
      transition_id,
      user_id,
      event_type,
      membership_version
    ) values (
      p_transition_id,
      p_user_id,
      'create_reserved',
      current_membership.membership_version
    );

    return jsonb_build_object(
      'result', 'reserved',
      'membership', to_jsonb(current_membership)
    );
  end if;

  if current_membership.status = 'moving'
    and current_membership.transition_id = p_transition_id then
    return jsonb_build_object(
      'result', 'reserved',
      'membership', to_jsonb(current_membership)
    );
  end if;

  if current_membership.status = 'moving'
    and current_membership.updated_at < now() - interval '2 minutes' then
    update public.active_room_memberships
    set
      player_id = p_player_id,
      membership_version = membership_version + 1,
      transition_id = p_transition_id,
      last_seen_at = now()
    where user_id = p_user_id
    returning * into current_membership;

    insert into public.room_membership_events (
      transition_id,
      user_id,
      event_type,
      membership_version,
      metadata
    ) values (
      p_transition_id,
      p_user_id,
      'create_reservation_recovered',
      current_membership.membership_version,
      jsonb_build_object('leaseSeconds', 120)
    );

    return jsonb_build_object(
      'result', 'reserved',
      'membership', to_jsonb(current_membership)
    );
  end if;

  return jsonb_build_object(
    'result', 'conflict',
    'membership', to_jsonb(current_membership)
  );
end;
$function$;

-- Body carried forward from 20260803013500_active_room_membership_recovery,
-- which supersedes the original in 20260803005931 -- the disconnect-timeout
-- lease branches below come from there and must not be dropped.
create or replace function public.claim_room_membership(
  p_user_id uuid,
  p_room_id uuid,
  p_player_id text,
  p_transition_id uuid
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  current_membership public.active_room_memberships%rowtype;
  has_membership boolean;
  previous_room_id uuid;
  claim_result text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select *
  into current_membership
  from public.active_room_memberships
  where user_id = p_user_id
  for update;

  has_membership := found;

  -- Only a membership pointing somewhere else can be stale here: claiming the
  -- same room again is the reconnect path, and that room is still live.
  if has_membership
    and current_membership.room_id is distinct from p_room_id
    and public.release_stale_room_membership(
      current_membership,
      p_transition_id
    ) then
    has_membership := false;
  end if;

  if not has_membership then
    insert into public.active_room_memberships (
      user_id,
      room_id,
      player_id,
      status,
      membership_version,
      transition_id,
      last_seen_at
    ) values (
      p_user_id,
      p_room_id,
      p_player_id,
      'active',
      1,
      p_transition_id,
      now()
    )
    returning * into current_membership;
    claim_result := 'claimed';
  elsif current_membership.status = 'moving'
    and current_membership.room_id is null
    and current_membership.transition_id = p_transition_id then
    previous_room_id := current_membership.room_id;
    update public.active_room_memberships
    set
      room_id = p_room_id,
      player_id = p_player_id,
      status = 'active',
      membership_version = membership_version + 1,
      last_seen_at = now()
    where user_id = p_user_id
    returning * into current_membership;
    claim_result := 'claimed';
  elsif current_membership.status = 'moving'
    and current_membership.room_id = p_room_id
    and current_membership.updated_at < now() - interval '30 seconds' then
    previous_room_id := current_membership.room_id;
    update public.active_room_memberships
    set
      player_id = p_player_id,
      status = 'active',
      membership_version = membership_version + 1,
      transition_id = p_transition_id,
      last_seen_at = now()
    where user_id = p_user_id
    returning * into current_membership;
    claim_result := 'reconnected';
  elsif current_membership.room_id = p_room_id
    and current_membership.status in ('active', 'disconnected') then
    previous_room_id := current_membership.room_id;
    update public.active_room_memberships
    set
      player_id = p_player_id,
      status = 'active',
      membership_version = membership_version + 1,
      transition_id = p_transition_id,
      last_seen_at = now()
    where user_id = p_user_id
    returning * into current_membership;
    claim_result := 'reconnected';
  else
    return jsonb_build_object(
      'result', 'conflict',
      'membership', to_jsonb(current_membership)
    );
  end if;

  insert into public.room_membership_events (
    transition_id,
    user_id,
    from_room_id,
    to_room_id,
    event_type,
    membership_version
  ) values (
    p_transition_id,
    p_user_id,
    previous_room_id,
    p_room_id,
    case
      when claim_result = 'reconnected' then 'room_reconnected'
      else 'room_claimed'
    end,
    current_membership.membership_version
  );

  return jsonb_build_object(
    'result', claim_result,
    'membership', to_jsonb(current_membership)
  );
end;
$function$;

revoke all on function public.release_stale_room_membership(
  public.active_room_memberships,
  uuid
) from public, anon, authenticated;

grant execute on function public.release_stale_room_membership(
  public.active_room_memberships,
  uuid
) to service_role;

select pg_notify('pgrst', 'reload schema');
