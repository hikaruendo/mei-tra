begin;

select plan(8);

select ok(
  strpos(
    pg_get_functiondef(
      'public.persist_room_roster_atomic(uuid,jsonb,jsonb,text,bigint,jsonb,jsonb,jsonb)'::regprocedure
    ),
    'requested_seat_id::text'
  ) = 0,
  'roster persistence passes seat UUID directly when claiming membership'
);

select ok(
  strpos(
    pg_get_functiondef(
      'public.persist_room_roster_atomic(uuid,jsonb,jsonb,text,bigint,jsonb,jsonb,jsonb)'::regprocedure
    ),
    'release_room_membership_by_player'
  ) = 0,
  'roster persistence does not call the removed text release function'
);

select ok(
  strpos(
    pg_get_functiondef(
      'public.persist_room_roster_atomic(uuid,jsonb,jsonb,text,bigint,jsonb,jsonb,jsonb)'::regprocedure
    ),
    'release_room_membership_by_seat'
  ) > 0,
  'roster persistence releases membership by seat UUID'
);

select ok(
  to_regprocedure(
    'public.claim_room_membership(uuid,uuid,text,uuid)'
  ) is null,
  'removed text claim overload stays unavailable'
);

insert into auth.users (
  id,
  email,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000009901',
  'roster-membership-uuid@example.com',
  '{"username":"roster_membership_uuid","display_name":"Roster Membership UUID"}'::jsonb,
  now(),
  now()
);

insert into public.rooms (id, name, host_seat_id)
values (
  '00000000-0000-0000-0000-000000009902',
  'Roster membership UUID room',
  '00000000-0000-4000-8000-000000009903'
);

insert into public.room_players (
  id,
  room_id,
  user_id,
  name,
  team,
  is_com,
  seat_index
)
values (
  '00000000-0000-4000-8000-000000009903',
  '00000000-0000-0000-0000-000000009902',
  '00000000-0000-0000-0000-000000009901',
  'Player',
  0,
  false,
  0
);

insert into public.game_states (room_id, state_data)
values (
  '00000000-0000-0000-0000-000000009902',
  '{
    "identitySchemaVersion":2,
    "playerStates":{
      "00000000-0000-4000-8000-000000009903":{"hand":[]}
    }
  }'::jsonb
);

select lives_ok(
  $$
    select public.persist_room_roster_atomic(
      '00000000-0000-0000-0000-000000009902',
      '[{
        "seatId":"00000000-0000-4000-8000-000000009903",
        "userId":"00000000-0000-0000-0000-000000009901",
        "name":"Player",
        "team":0,
        "isReady":true,
        "isCOM":false,
        "joinedAt":"2026-08-15T00:00:00.000Z",
        "seatIndex":0
      }]'::jsonb,
      '{
        "00000000-0000-4000-8000-000000009903":{"hand":[]}
      }'::jsonb,
      '00000000-0000-4000-8000-000000009903',
      0,
      '{}'::jsonb,
      '{}'::jsonb,
      '{
        "type":"claim",
        "userId":"00000000-0000-0000-0000-000000009901",
        "transitionId":"00000000-0000-4000-8000-000000009904"
      }'::jsonb
    )
  $$,
  'roster persistence claims membership through the UUID function'
);

select is(
  (
    select seat_id
    from public.active_room_memberships
    where user_id = '00000000-0000-0000-0000-000000009901'
  ),
  '00000000-0000-4000-8000-000000009903'::uuid,
  'the claimed membership references the canonical seat UUID'
);

select lives_ok(
  $$
    select public.persist_room_roster_atomic(
      '00000000-0000-0000-0000-000000009902',
      '[{
        "seatId":"00000000-0000-4000-8000-000000009903",
        "userId":null,
        "name":"COM",
        "team":0,
        "isReady":true,
        "isCOM":true,
        "joinedAt":"2026-08-15T00:00:00.000Z",
        "seatIndex":0
      }]'::jsonb,
      '{
        "00000000-0000-4000-8000-000000009903":{"hand":[]}
      }'::jsonb,
      '00000000-0000-4000-8000-000000009903',
      1,
      '{}'::jsonb,
      '{}'::jsonb,
      '{
        "type":"release",
        "seatId":"00000000-0000-4000-8000-000000009903",
        "transitionId":"00000000-0000-4000-8000-000000009905"
      }'::jsonb
    )
  $$,
  'roster persistence releases membership through the UUID function'
);

select is(
  (
    select count(*)
    from public.active_room_memberships
    where user_id = '00000000-0000-0000-0000-000000009901'
  ),
  0::bigint,
  'the released membership is removed'
);

select * from finish();

rollback;
