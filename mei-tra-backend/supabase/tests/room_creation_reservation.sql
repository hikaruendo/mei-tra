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
  '00000000-0000-0000-0000-000000000981',
  'room-creation-reservation-test@example.com',
  '{"username":"reservation_test","display_name":"Reservation Test"}'::jsonb,
  now(),
  now()
);

do $test$
declare
  result jsonb;
  test_user constant uuid := '00000000-0000-0000-0000-000000000981';
  host_seat constant uuid := '00000000-0000-4000-8000-000000000982';
  test_room constant uuid := '00000000-0000-0000-0000-000000000983';
  initial_transition constant uuid :=
    '00000000-0000-4000-8000-000000000984';
  recovered_transition constant uuid :=
    '00000000-0000-4000-8000-000000000985';
  create_transition constant uuid :=
    '00000000-0000-4000-8000-000000000986';
  timeout_transition constant uuid :=
    '00000000-0000-4000-8000-000000000987';
begin
  result := public.reserve_room_membership(
    test_user,
    host_seat::text,
    initial_transition
  );
  if result->>'result' <> 'reserved' then
    raise exception 'pre-seat reservation failed: %', result;
  end if;

  set constraints all immediate;

  if not exists (
    select 1
    from public.room_membership_events
    where transition_id = initial_transition
      and event_type = 'create_reserved'
      and seat_id is null
      and metadata->>'reservedSeatId' = host_seat::text
  ) then
    raise exception 'pre-seat reservation event persisted an invalid seat FK';
  end if;

  alter table public.active_room_memberships
    disable trigger update_active_room_memberships_updated_at;
  update public.active_room_memberships
  set updated_at = now() - interval '3 minutes'
  where user_id = test_user;
  alter table public.active_room_memberships
    enable trigger update_active_room_memberships_updated_at;

  result := public.reserve_room_membership(
    test_user,
    host_seat::text,
    recovered_transition
  );
  if result->>'result' <> 'reserved' then
    raise exception 'stale pre-seat reservation recovery failed: %', result;
  end if;

  set constraints all immediate;

  if not exists (
    select 1
    from public.room_membership_events
    where transition_id = recovered_transition
      and event_type = 'create_reservation_recovered'
      and seat_id is null
      and metadata->>'reservedSeatId' = host_seat::text
      and metadata->>'leaseSeconds' = '120'
  ) then
    raise exception 'recovered reservation event persisted an invalid seat FK';
  end if;

  if not public.cancel_room_membership_reservation(
    test_user,
    recovered_transition
  ) then
    raise exception 'pre-seat reservation cancellation failed';
  end if;

  set constraints all immediate;

  if not exists (
    select 1
    from public.room_membership_events
    where transition_id = recovered_transition
      and event_type = 'create_reservation_cancelled'
      and seat_id is null
      and metadata->>'reservedSeatId' = host_seat::text
  ) then
    raise exception 'reservation cancellation event persisted an invalid seat FK';
  end if;

  result := public.reserve_room_membership(
    test_user,
    host_seat::text,
    create_transition
  );
  if result->>'result' <> 'reserved' then
    raise exception 'room creation reservation failed: %', result;
  end if;

  set constraints all immediate;
  set constraints all deferred;

  result := public.create_room_with_host_seat_atomic(
    test_room,
    'Reservation test room',
    host_seat,
    test_user,
    'Reservation Test',
    '{}'::jsonb,
    5,
    create_transition
  );

  set constraints all immediate;

  if result->'roomPlayer'->>'id' <> host_seat::text
    or not exists (
      select 1
      from public.room_membership_events
      where transition_id = create_transition
        and event_type = 'room_created_and_claimed'
        and seat_id = host_seat
    ) then
    raise exception 'room creation did not claim the reserved canonical seat';
  end if;

  update public.active_room_memberships
  set
    status = 'moving',
    transition_id = timeout_transition
  where user_id = test_user;

  if public.cancel_room_membership_reservation(
    test_user,
    timeout_transition
  ) then
    raise exception 'room-bound moving membership was cancelled as a reservation';
  end if;

  if not exists (
    select 1
    from public.active_room_memberships
    where user_id = test_user
      and room_id = test_room
      and seat_id = host_seat
      and status = 'moving'
  ) then
    raise exception 'room-bound moving membership was deleted';
  end if;
end;
$test$;

select pass('room creation reservation supports seats before room creation');
select * from finish();

rollback;
