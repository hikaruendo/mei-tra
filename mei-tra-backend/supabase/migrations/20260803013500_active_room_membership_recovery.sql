create or replace function public.mark_room_membership_disconnected(
  p_user_id uuid,
  p_room_id uuid,
  p_expected_version bigint,
  p_transition_id uuid
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  current_membership public.active_room_memberships%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select *
  into current_membership
  from public.active_room_memberships
  where user_id = p_user_id
  for update;

  if not found
    or current_membership.room_id is distinct from p_room_id
    or current_membership.membership_version <> p_expected_version
    or current_membership.status <> 'active' then
    return jsonb_build_object(
      'result', 'stale',
      'membership', case
        when current_membership.user_id is null then null
        else to_jsonb(current_membership)
      end
    );
  end if;

  update public.active_room_memberships
  set
    status = 'disconnected',
    membership_version = membership_version + 1,
    transition_id = p_transition_id,
    last_seen_at = now()
  where user_id = p_user_id
  returning * into current_membership;

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
    p_room_id,
    p_room_id,
    'room_disconnected',
    current_membership.membership_version
  );

  return jsonb_build_object(
    'result', 'disconnected',
    'membership', to_jsonb(current_membership)
  );
end;
$function$;

create or replace function public.start_room_membership_timeout(
  p_user_id uuid,
  p_room_id uuid,
  p_expected_version bigint,
  p_transition_id uuid
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  current_membership public.active_room_memberships%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select *
  into current_membership
  from public.active_room_memberships
  where user_id = p_user_id
  for update;

  if not found
    or current_membership.room_id is distinct from p_room_id
    or current_membership.membership_version <> p_expected_version
    or current_membership.status <> 'disconnected' then
    return jsonb_build_object(
      'result', 'stale',
      'membership', case
        when current_membership.user_id is null then null
        else to_jsonb(current_membership)
      end
    );
  end if;

  update public.active_room_memberships
  set
    status = 'moving',
    membership_version = membership_version + 1,
    transition_id = p_transition_id,
    last_seen_at = now()
  where user_id = p_user_id
  returning * into current_membership;

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
    p_room_id,
    p_room_id,
    'disconnect_timeout_started',
    current_membership.membership_version
  );

  return jsonb_build_object(
    'result', 'started',
    'membership', to_jsonb(current_membership)
  );
end;
$function$;

create or replace function public.finish_room_membership_timeout(
  p_user_id uuid,
  p_room_id uuid,
  p_expected_version bigint,
  p_transition_id uuid,
  p_succeeded boolean
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  current_membership public.active_room_memberships%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select *
  into current_membership
  from public.active_room_memberships
  where user_id = p_user_id
  for update;

  if not found
    or current_membership.room_id is distinct from p_room_id
    or current_membership.membership_version <> p_expected_version
    or current_membership.status <> 'moving'
    or current_membership.transition_id <> p_transition_id then
    return jsonb_build_object(
      'result', 'stale',
      'membership', case
        when current_membership.user_id is null then null
        else to_jsonb(current_membership)
      end
    );
  end if;

  if p_succeeded then
    delete from public.active_room_memberships
    where user_id = p_user_id;

    insert into public.room_membership_events (
      transition_id,
      user_id,
      from_room_id,
      event_type,
      membership_version
    ) values (
      p_transition_id,
      p_user_id,
      p_room_id,
      'disconnect_timeout_completed',
      current_membership.membership_version
    );

    return jsonb_build_object('result', 'completed');
  end if;

  update public.active_room_memberships
  set
    status = 'disconnected',
    membership_version = membership_version + 1,
    last_seen_at = now()
  where user_id = p_user_id
  returning * into current_membership;

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
    p_room_id,
    p_room_id,
    'disconnect_timeout_rolled_back',
    current_membership.membership_version
  );

  return jsonb_build_object(
    'result', 'rolled_back',
    'membership', to_jsonb(current_membership)
  );
end;
$function$;

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
  previous_room_id uuid;
  claim_result text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select *
  into current_membership
  from public.active_room_memberships
  where user_id = p_user_id
  for update;

  if not found then
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

revoke all on function public.mark_room_membership_disconnected(uuid, uuid, bigint, uuid)
  from public, anon, authenticated;
revoke all on function public.start_room_membership_timeout(uuid, uuid, bigint, uuid)
  from public, anon, authenticated;
revoke all on function public.finish_room_membership_timeout(uuid, uuid, bigint, uuid, boolean)
  from public, anon, authenticated;

grant execute on function public.mark_room_membership_disconnected(uuid, uuid, bigint, uuid)
  to service_role;
grant execute on function public.start_room_membership_timeout(uuid, uuid, bigint, uuid)
  to service_role;
grant execute on function public.finish_room_membership_timeout(uuid, uuid, bigint, uuid, boolean)
  to service_role;
