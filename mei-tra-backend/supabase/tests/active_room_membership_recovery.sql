begin;

select plan(1);

insert into auth.users (
  id,
  email,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000921',
  'membership-recovery@example.com',
  '{"username":"membership_recovery","display_name":"Membership Recovery"}'::jsonb,
  now(),
  now()
);

insert into public.rooms (id, name)
values (
  '00000000-0000-0000-0000-000000000922',
  'Membership recovery room'
);

insert into public.room_players (id, room_id, name, team, seat_index)
values (
  '00000000-0000-4000-8000-000000000928',
  '00000000-0000-0000-0000-000000000922',
  'Recovery seat',
  0,
  0
);

set constraints all immediate;

do $test$
declare
  result jsonb;
  current_version bigint;
  timeout_version bigint;
  timeout_transition uuid;
  test_user constant uuid := '00000000-0000-0000-0000-000000000921';
  test_room constant uuid := '00000000-0000-0000-0000-000000000922';
  test_seat constant uuid := '00000000-0000-4000-8000-000000000928';
  claim_transition constant uuid := '00000000-0000-4000-8000-000000000923';
  disconnect_transition constant uuid := '00000000-0000-4000-8000-000000000924';
  timeout_transition_one constant uuid := '00000000-0000-4000-8000-000000000925';
  reconnect_transition constant uuid := '00000000-0000-4000-8000-000000000926';
  timeout_transition_two constant uuid := '00000000-0000-4000-8000-000000000927';
begin
  if has_function_privilege(
    'authenticated',
    'public.start_room_membership_timeout(uuid,uuid,bigint,uuid)',
    'execute'
  ) then
    raise exception 'authenticated can start a membership timeout';
  end if;

  result := public.claim_room_membership(
    test_user,
    test_room,
    test_seat::text,
    claim_transition
  );
  current_version := (result->'membership'->>'membership_version')::bigint;

  result := public.mark_room_membership_disconnected(
    test_user,
    test_room,
    current_version,
    disconnect_transition
  );
  if result->>'result' <> 'disconnected' then
    raise exception 'disconnect transition failed: %', result;
  end if;
  current_version := (result->'membership'->>'membership_version')::bigint;

  result := public.claim_room_membership(
    test_user,
    test_room,
    test_seat::text,
    reconnect_transition
  );
  if result->>'result' <> 'reconnected' then
    raise exception 'reconnect after disconnect failed: %', result;
  end if;

  result := public.start_room_membership_timeout(
    test_user,
    test_room,
    current_version,
    timeout_transition_one
  );
  if result->>'result' <> 'stale' then
    raise exception 'stale timeout was not rejected after reconnect: %', result;
  end if;

  current_version := (select membership_version from public.active_room_memberships where user_id = test_user);
  result := public.mark_room_membership_disconnected(
    test_user,
    test_room,
    current_version,
    disconnect_transition
  );
  current_version := (result->'membership'->>'membership_version')::bigint;

  result := public.start_room_membership_timeout(
    test_user,
    test_room,
    current_version,
    timeout_transition_one
  );
  if result->>'result' <> 'started' then
    raise exception 'timeout lease failed: %', result;
  end if;
  timeout_version := (result->'membership'->>'membership_version')::bigint;
  timeout_transition := (result->'membership'->>'transition_id')::uuid;

  result := public.claim_room_membership(
    test_user,
    test_room,
    test_seat::text,
    reconnect_transition
  );
  if result->>'result' <> 'conflict' then
    raise exception 'reconnect entered during timeout lease: %', result;
  end if;

  result := public.finish_room_membership_timeout(
    test_user,
    test_room,
    timeout_version,
    timeout_transition,
    false
  );
  if result->>'result' <> 'rolled_back' then
    raise exception 'timeout rollback failed: %', result;
  end if;

  result := public.claim_room_membership(
    test_user,
    test_room,
    test_seat::text,
    reconnect_transition
  );
  current_version := (result->'membership'->>'membership_version')::bigint;
  result := public.mark_room_membership_disconnected(
    test_user,
    test_room,
    current_version,
    disconnect_transition
  );
  current_version := (result->'membership'->>'membership_version')::bigint;
  result := public.start_room_membership_timeout(
    test_user,
    test_room,
    current_version,
    timeout_transition_two
  );
  timeout_version := (result->'membership'->>'membership_version')::bigint;
  timeout_transition := (result->'membership'->>'transition_id')::uuid;
  result := public.finish_room_membership_timeout(
    test_user,
    test_room,
    timeout_version,
    timeout_transition,
    true
  );
  if result->>'result' <> 'completed' then
    raise exception 'timeout completion failed: %', result;
  end if;
  if exists (
    select 1 from public.active_room_memberships where user_id = test_user
  ) then
    raise exception 'completed timeout left an active membership';
  end if;

  result := public.claim_room_membership(
    test_user,
    test_room,
    test_seat::text,
    claim_transition
  );
  current_version := (result->'membership'->>'membership_version')::bigint;
  result := public.mark_room_membership_disconnected(
    test_user,
    test_room,
    current_version,
    disconnect_transition
  );
  current_version := (result->'membership'->>'membership_version')::bigint;
  result := public.start_room_membership_timeout(
    test_user,
    test_room,
    current_version,
    timeout_transition_two
  );
  alter table public.active_room_memberships
    disable trigger update_active_room_memberships_updated_at;
  update public.active_room_memberships
  set updated_at = now() - interval '31 seconds'
  where user_id = test_user;
  alter table public.active_room_memberships
    enable trigger update_active_room_memberships_updated_at;
  result := public.claim_room_membership(
    test_user,
    test_room,
    test_seat::text,
    reconnect_transition
  );
  if result->>'result' <> 'reconnected' then
    raise exception 'stale timeout lease was not recovered: %', result;
  end if;
end;
$test$;

select pass('disconnected memberships recover without changing their seat UUID');
select * from finish();

rollback;
