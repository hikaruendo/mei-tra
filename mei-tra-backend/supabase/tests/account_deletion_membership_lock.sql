begin;

select plan(1);

do $$
begin
  if has_function_privilege(
    'anon',
    'public.mark_account_deletion_started(uuid)',
    'execute'
  ) then
    raise exception 'anon can execute mark_account_deletion_started';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.mark_account_deletion_started(uuid)',
    'execute'
  ) then
    raise exception 'authenticated can execute mark_account_deletion_started';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.mark_account_deletion_started(uuid)',
    'execute'
  ) then
    raise exception 'service_role cannot execute mark_account_deletion_started';
  end if;
end;
$$;

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000931',
  'authenticated',
  'authenticated',
  'account-membership-lock-test@example.com',
  '',
  now(),
  now(),
  now()
);

update public.user_profiles
set username = 'account_membership_lock_test',
    display_name = 'Account membership lock test'
where id = '00000000-0000-0000-0000-000000000931';

insert into public.rooms (id, name, host_seat_id, status)
values (
  '00000000-0000-0000-0000-000000000932',
  'Account membership active blocker room',
  '00000000-0000-0000-0000-000000000934',
  'waiting'
);

insert into public.game_states (id, room_id, state_data)
values (
  '00000000-0000-0000-0000-000000000933',
  '00000000-0000-0000-0000-000000000932',
  '{}'::jsonb
);

insert into public.room_players (
  id,
  room_id,
  user_id,
  name,
  seat_index
)
values (
  '00000000-0000-0000-0000-000000000934',
  '00000000-0000-0000-0000-000000000932',
  '00000000-0000-0000-0000-000000000931',
  'Account membership lock test',
  0
);

do $$
declare
  failed boolean := false;
begin
  begin
    perform public.mark_account_deletion_started(
      '00000000-0000-0000-0000-000000000931'
    );
  exception
    when sqlstate 'PT409' then
      failed := true;
  end;

  if not failed then
    raise exception 'Expected active room blocker from mark_account_deletion_started';
  end if;

  if exists (
    select 1
    from public.user_profiles
    where id = '00000000-0000-0000-0000-000000000931'
      and account_deletion_started_at is not null
  ) then
    raise exception 'Blocked account deletion still marked the user';
  end if;
end;
$$;

update public.rooms
set status = 'finished'
where id = '00000000-0000-0000-0000-000000000932';

do $$
declare
  marked jsonb;
begin
  marked := public.mark_account_deletion_started(
    '00000000-0000-0000-0000-000000000931'
  );

  if marked is null
    or marked->>'id' <> '00000000-0000-0000-0000-000000000931'
    or marked->>'account_deletion_started_at' is null
  then
    raise exception 'mark_account_deletion_started did not return the marked profile';
  end if;
end;
$$;

do $$
declare
  failed boolean := false;
begin
  begin
    insert into public.room_players (
      id,
      room_id,
      user_id,
      name,
      seat_index
    )
    values (
      '00000000-0000-4000-8000-000000000935',
      '00000000-0000-0000-0000-000000000932',
      '00000000-0000-0000-0000-000000000931',
      'Should be rejected',
      1
    );
  exception
    when sqlstate 'PT403' then
      failed := true;
  end;

  if not failed then
    raise exception 'Expected room_players trigger to reject deleting user';
  end if;
end;
$$;

select pass('account deletion and room membership updates remain serialized');
select * from finish();

rollback;
