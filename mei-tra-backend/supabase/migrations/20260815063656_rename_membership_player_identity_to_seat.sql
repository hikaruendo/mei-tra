create or replace function public.release_room_membership_by_seat(
  p_room_id uuid,
  p_seat_id uuid,
  p_transition_id uuid
)
returns boolean
language plpgsql
set search_path to ''
as $function$
declare
  target_membership public.active_room_memberships%rowtype;
begin
  select *
  into target_membership
  from public.active_room_memberships
  where room_id = p_room_id
    and seat_id = p_seat_id;

  if not found then
    return false;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_membership.user_id::text, 0)
  );

  delete from public.active_room_memberships
  where user_id = target_membership.user_id
    and room_id = p_room_id
    and seat_id = p_seat_id;

  if not found then
    return false;
  end if;

  insert into public.room_membership_events (
    transition_id,
    user_id,
    from_room_id,
    seat_id,
    event_type,
    membership_version
  ) values (
    p_transition_id,
    target_membership.user_id,
    p_room_id,
    p_seat_id,
    'player_membership_released',
    target_membership.membership_version
  );

  return true;
end;
$function$;

create or replace function public.reserve_room_membership(
  p_user_id uuid,
  p_seat_id uuid,
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
      seat_id,
      status,
      membership_version,
      transition_id
    ) values (
      p_user_id,
      null,
      p_seat_id,
      'moving',
      1,
      p_transition_id
    )
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
      'create_reserved',
      current_membership.membership_version,
      jsonb_build_object('reservedSeatId', p_seat_id)
    );

    return jsonb_build_object(
      'result', 'reserved',
      'membership', to_jsonb(current_membership)
    );
  end if;

  if current_membership.status = 'moving'
    and current_membership.transition_id = p_transition_id
    and current_membership.seat_id = p_seat_id then
    return jsonb_build_object(
      'result', 'reserved',
      'membership', to_jsonb(current_membership)
    );
  end if;

  if current_membership.status = 'moving'
    and current_membership.updated_at < now() - interval '2 minutes' then
    update public.active_room_memberships
    set
      seat_id = p_seat_id,
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
      jsonb_build_object(
        'leaseSeconds',
        120,
        'reservedSeatId',
        p_seat_id
      )
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

create or replace function public.claim_room_membership(
  p_user_id uuid,
  p_room_id uuid,
  p_seat_id uuid,
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
  if not exists (
    select 1
    from public.room_players
    where room_id = p_room_id
      and id = p_seat_id
  ) then
    raise exception 'membership_seat_not_in_room room=% seat=%',
      p_room_id,
      p_seat_id
      using errcode = 'PT422';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select *
  into current_membership
  from public.active_room_memberships
  where user_id = p_user_id
  for update;

  has_membership := found;

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
      seat_id,
      status,
      membership_version,
      transition_id,
      last_seen_at
    ) values (
      p_user_id,
      p_room_id,
      p_seat_id,
      'active',
      1,
      p_transition_id,
      now()
    )
    returning * into current_membership;
    claim_result := 'claimed';
  elsif current_membership.status = 'moving'
    and current_membership.room_id is null
    and current_membership.transition_id = p_transition_id
    and current_membership.seat_id = p_seat_id then
    previous_room_id := current_membership.room_id;
    update public.active_room_memberships
    set
      room_id = p_room_id,
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
      seat_id = p_seat_id,
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
      seat_id = p_seat_id,
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
    seat_id,
    event_type,
    membership_version
  ) values (
    p_transition_id,
    p_user_id,
    previous_room_id,
    p_room_id,
    p_seat_id,
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

revoke all on function public.reserve_room_membership(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.claim_room_membership(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.release_room_membership_by_seat(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.reserve_room_membership(uuid, uuid, uuid)
  to service_role;
grant execute on function public.claim_room_membership(uuid, uuid, uuid, uuid)
  to service_role;
grant execute on function public.release_room_membership_by_seat(uuid, uuid, uuid)
  to service_role;

drop function public.reserve_room_membership(uuid, text, uuid);
drop function public.claim_room_membership(uuid, uuid, text, uuid);
drop function public.release_room_membership_by_player(uuid, text, uuid);

select pg_notify('pgrst', 'reload schema');
