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
  '00000000-0000-0000-0000-000000000911',
  'membership-test@example.com',
  '{"username":"membership_test","display_name":"Membership Test"}'::jsonb,
  now(),
  now()
);

insert into public.rooms (id, name)
values
  (
    '00000000-0000-0000-0000-000000000912',
    'Membership room A'
  ),
  (
    '00000000-0000-0000-0000-000000000913',
    'Membership room B'
  );

insert into public.room_players (id, room_id, name, team, seat_index)
values
  (
    '00000000-0000-4000-8000-000000000917',
    '00000000-0000-0000-0000-000000000912',
    'Seat A',
    0,
    0
  ),
  (
    '00000000-0000-4000-8000-000000000918',
    '00000000-0000-0000-0000-000000000913',
    'Seat B',
    1,
    0
  );

do $test$
declare
  result jsonb;
  current_version bigint;
  test_user constant uuid := '00000000-0000-0000-0000-000000000911';
  first_room constant uuid := '00000000-0000-0000-0000-000000000912';
  second_room constant uuid := '00000000-0000-0000-0000-000000000913';
  first_seat constant uuid := '00000000-0000-4000-8000-000000000917';
  second_seat constant uuid := '00000000-0000-4000-8000-000000000918';
  first_transition constant uuid := '00000000-0000-4000-8000-000000000914';
  second_transition constant uuid := '00000000-0000-4000-8000-000000000915';
  third_transition constant uuid := '00000000-0000-4000-8000-000000000916';
begin
  if has_function_privilege(
    'anon',
    'public.claim_room_membership(uuid,uuid,text,uuid)',
    'execute'
  ) then
    raise exception 'anon can claim room membership';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.claim_room_membership(uuid,uuid,text,uuid)',
    'execute'
  ) then
    raise exception 'service_role cannot claim room membership';
  end if;

  result := public.claim_room_membership(
    test_user,
    first_room,
    first_seat::text,
    first_transition
  );
  if result->>'result' <> 'claimed' then
    raise exception 'first membership claim failed: %', result;
  end if;

  result := public.claim_room_membership(
    test_user,
    second_room,
    second_seat::text,
    second_transition
  );
  if result->>'result' <> 'conflict' then
    raise exception 'cross-room membership was not rejected: %', result;
  end if;

  result := public.claim_room_membership(
    test_user,
    first_room,
    first_seat::text,
    second_transition
  );
  if result->>'result' <> 'reconnected' then
    raise exception 'same-room reconnect failed: %', result;
  end if;

  select membership_version
  into current_version
  from public.active_room_memberships
  where user_id = test_user;

  result := public.release_room_membership(
    test_user,
    first_room,
    current_version - 1,
    third_transition
  );
  if result->>'result' <> 'stale' then
    raise exception 'stale release was not rejected: %', result;
  end if;

  result := public.release_room_membership(
    test_user,
    first_room,
    current_version,
    third_transition
  );
  if result->>'result' <> 'released' then
    raise exception 'membership release failed: %', result;
  end if;

  result := public.reserve_room_membership(
    test_user,
    second_seat::text,
    first_transition
  );
  if result->>'result' <> 'reserved' then
    raise exception 'membership reservation failed: %', result;
  end if;

  result := public.reserve_room_membership(
    test_user,
    second_seat::text,
    first_transition
  );
  if result->>'result' <> 'reserved' then
    raise exception 'membership reservation was not idempotent: %', result;
  end if;

  result := public.claim_room_membership(
    test_user,
    second_room,
    second_seat::text,
    first_transition
  );
  if result->>'result' <> 'claimed' then
    raise exception 'reserved membership claim failed: %', result;
  end if;

  if not public.release_room_membership_by_player(
    second_room,
    second_seat::text,
    third_transition
  ) then
    raise exception 'player membership release failed';
  end if;
end;
$test$;

select pass('active room membership transitions preserve canonical seats');
select * from finish();

rollback;
