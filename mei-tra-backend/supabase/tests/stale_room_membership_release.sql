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
  'stale-membership-test@example.com',
  '{"username":"stale_membership_test","display_name":"Stale Membership"}'::jsonb,
  now(),
  now()
);

insert into public.rooms (id, name, status)
values
  (
    '00000000-0000-0000-0000-000000000922',
    'Stale room A',
    'playing'
  ),
  (
    '00000000-0000-0000-0000-000000000923',
    'Stale room B',
    'waiting'
  );

insert into public.room_players (id, room_id, name, team, seat_index)
values
  (
    '00000000-0000-4000-8000-000000000928',
    '00000000-0000-0000-0000-000000000922',
    'Stale seat A',
    0,
    0
  ),
  (
    '00000000-0000-4000-8000-000000000929',
    '00000000-0000-0000-0000-000000000923',
    'Stale seat B',
    1,
    0
  );

do $test$
declare
  result jsonb;
  membership public.active_room_memberships%rowtype;
  released_events integer;
  test_user constant uuid := '00000000-0000-0000-0000-000000000921';
  room_a constant uuid := '00000000-0000-0000-0000-000000000922';
  room_b constant uuid := '00000000-0000-0000-0000-000000000923';
  seat_a constant uuid := '00000000-0000-4000-8000-000000000928';
  seat_b constant uuid := '00000000-0000-4000-8000-000000000929';
  next_seat constant uuid := '00000000-0000-4000-8000-000000000930';
  t1 constant uuid := '00000000-0000-4000-8000-000000000924';
  t2 constant uuid := '00000000-0000-4000-8000-000000000925';
  t3 constant uuid := '00000000-0000-4000-8000-000000000926';
  t4 constant uuid := '00000000-0000-4000-8000-000000000927';
begin
  if has_function_privilege(
    'anon',
    'public.release_stale_room_membership(public.active_room_memberships,uuid)',
    'execute'
  ) then
    raise exception 'anon can release stale room memberships';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.release_stale_room_membership(public.active_room_memberships,uuid)',
    'execute'
  ) then
    raise exception 'service_role cannot release stale room memberships';
  end if;

  result := public.claim_room_membership(test_user, room_a, seat_a::text, t1);
  if result->>'result' <> 'claimed' then
    raise exception 'setup claim failed: %', result;
  end if;

  -- A live room must keep behaving exactly as before.
  result := public.reserve_room_membership(test_user, seat_b::text, t2);
  if result->>'result' <> 'conflict' then
    raise exception 'live room did not block reservation: %', result;
  end if;

  result := public.claim_room_membership(test_user, room_b, seat_b::text, t2);
  if result->>'result' <> 'conflict' then
    raise exception 'live room did not block cross-room claim: %', result;
  end if;

  result := public.claim_room_membership(test_user, room_a, seat_a::text, t2);
  if result->>'result' <> 'reconnected' then
    raise exception 'live room reconnect broke: %', result;
  end if;

  -- Room A finishes. The membership release that normally follows the status
  -- write is skipped here, standing in for a crash between the two.
  update public.rooms set status = 'finished' where id = room_a;

  result := public.claim_room_membership(test_user, room_b, seat_b::text, t3);
  if result->>'result' <> 'claimed' then
    raise exception 'finished room still blocked a claim: %', result;
  end if;

  select count(*)
  into released_events
  from public.room_membership_events
  where user_id = test_user
    and event_type = 'stale_room_released'
    and from_room_id = room_a;
  if released_events <> 1 then
    raise exception
      'expected one stale_room_released event for room A, got %',
      released_events;
  end if;

  select * into membership
  from public.active_room_memberships
  where user_id = test_user;
  if membership.room_id <> room_b or membership.status <> 'active' then
    raise exception 'membership did not move to room B: %', to_jsonb(membership);
  end if;

  -- Same check on the reserve path, and for 'abandoned' as well as 'finished'.
  update public.rooms set status = 'abandoned' where id = room_b;

  result := public.reserve_room_membership(test_user, next_seat::text, t4);
  if result->>'result' <> 'reserved' then
    raise exception 'abandoned room still blocked a reservation: %', result;
  end if;

  select * into membership
  from public.active_room_memberships
  where user_id = test_user;
  if membership.room_id is not null or membership.status <> 'moving' then
    raise exception
      'reservation did not clear the stale room: %',
      to_jsonb(membership);
  end if;
end;
$test$;

select pass('stale room membership release keeps the reserved seat identity');
select * from finish();

rollback;
