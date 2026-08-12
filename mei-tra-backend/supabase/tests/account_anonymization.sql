begin;

select plan(1);

do $$
begin
  if has_function_privilege(
    'anon',
    'public.anonymize_account_references(uuid)',
    'execute'
  ) then
    raise exception 'anon can execute anonymize_account_references';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.anonymize_account_references(uuid)',
    'execute'
  ) then
    raise exception 'authenticated can execute anonymize_account_references';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.anonymize_account_references(uuid)',
    'execute'
  ) then
    raise exception 'service_role cannot execute anonymize_account_references';
  end if;

  if has_schema_privilege('anon', 'meitra_private', 'usage') then
    raise exception 'anon can use meitra_private';
  end if;

  if has_table_privilege(
    'authenticated',
    'meitra_private.account_anonymization_player_map',
    'select'
  ) then
    raise exception 'authenticated can read anonymization mappings';
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
  '00000000-0000-0000-0000-000000000921',
  'authenticated',
  'authenticated',
  'account-anonymization-test@example.com',
  '',
  now(),
  now(),
  now()
);

update public.user_profiles
set username = 'account_anonymization_test',
    display_name = 'Account anonymization test'
where id = '00000000-0000-0000-0000-000000000921';

insert into public.rooms (id, name, host_seat_id, status)
values (
  '00000000-0000-0000-0000-000000000922',
  'Account anonymization test room',
  '00000000-0000-0000-0000-000000000925',
  'finished'
);

insert into public.game_states (id, room_id, state_data, current_seat_id)
values (
  '00000000-0000-0000-0000-000000000923',
  '00000000-0000-0000-0000-000000000922',
  '{
    "identitySchemaVersion": 2,
    "playerStates": {
      "00000000-0000-0000-0000-000000000925": {"hand": ["A_SPADE"]}
    },
    "playerNames": {
      "00000000-0000-0000-0000-000000000925": "Account anonymization test"
    }
  }'::jsonb,
  '00000000-0000-0000-0000-000000000925'
);

insert into public.room_players (
  id,
  room_id,
  user_id,
  name,
  seat_index
)
values (
  '00000000-0000-0000-0000-000000000925',
  '00000000-0000-0000-0000-000000000922',
  '00000000-0000-0000-0000-000000000921',
  'Account anonymization test',
  0
);

insert into public.game_history (
  id,
  room_id,
  game_state_id,
  action_type,
  actor_seat_id,
  action_data
)
values (
  '00000000-0000-0000-0000-000000000924',
  '00000000-0000-0000-0000-000000000922',
  '00000000-0000-0000-0000-000000000923',
  'play',
  '00000000-0000-0000-0000-000000000925',
  '{
    "winnerSeatId": "00000000-0000-0000-0000-000000000925",
    "playerNames": {
      "00000000-0000-0000-0000-000000000925": "Account anonymization test"
    }
  }'::jsonb
);

update public.user_profiles
set account_deletion_started_at = now()
where id = '00000000-0000-0000-0000-000000000921';

create or replace function public.test_fail_account_anonymization_history_update()
returns trigger
language plpgsql
as $function$
begin
  raise exception 'injected account anonymization failure';
end;
$function$;

create trigger fail_account_anonymization_history_update
before update of action_data on public.game_history
for each row
when (old.id = '00000000-0000-0000-0000-000000000924'::uuid)
execute function public.test_fail_account_anonymization_history_update();

do $$
declare
  failed boolean := false;
begin
  begin
    perform public.anonymize_account_references(
      '00000000-0000-0000-0000-000000000921'
    );
  exception
    when others then
      failed := true;
  end;

  if not failed then
    raise exception 'Expected injected anonymization failure';
  end if;

  if not exists (
    select 1
    from public.room_players
    where id = '00000000-0000-0000-0000-000000000925'
      and user_id = '00000000-0000-0000-0000-000000000921'
      and name = 'Account anonymization test'
  ) then
    raise exception 'Failed anonymization changed room_players';
  end if;

  if not exists (
    select 1
    from public.rooms
    where id = '00000000-0000-0000-0000-000000000922'
      and host_seat_id = '00000000-0000-0000-0000-000000000925'
  ) then
    raise exception 'Failed anonymization changed rooms';
  end if;

  if not exists (
    select 1
    from public.game_states
    where id = '00000000-0000-0000-0000-000000000923'
      and state_data->'playerNames'
        ->>'00000000-0000-0000-0000-000000000925'
        = 'Account anonymization test'
  ) then
    raise exception 'Failed anonymization changed game_states';
  end if;

  if not exists (
    select 1
    from public.game_history
    where id = '00000000-0000-0000-0000-000000000924'
      and actor_seat_id = '00000000-0000-0000-0000-000000000925'
      and action_data->'playerNames'
        ->>'00000000-0000-0000-0000-000000000925'
        = 'Account anonymization test'
  ) then
    raise exception 'Failed anonymization changed game_history';
  end if;

  if exists (
    select 1
    from meitra_private.account_anonymization_player_map
    where user_id = '00000000-0000-0000-0000-000000000921'
  ) then
    raise exception 'Failed anonymization left a mapping after rollback';
  end if;
end;
$$;

drop trigger fail_account_anonymization_history_update on public.game_history;
drop function public.test_fail_account_anonymization_history_update();

do $$
declare
  result jsonb;
begin
  result := public.anonymize_account_references(
    '00000000-0000-0000-0000-000000000921'
  );

  if result <> '{
    "anonymized_room_player_count": 1,
    "anonymized_room_count": 0,
    "anonymized_game_state_count": 1,
    "anonymized_game_history_count": 1
  }'::jsonb then
    raise exception 'Unexpected first anonymization result: %', result;
  end if;
end;
$$;

do $$
declare
  room_host_seat_id uuid;
  room_player_id uuid;
  result jsonb;
begin
  select room.host_seat_id, room_player.id
  into room_host_seat_id, room_player_id
  from public.rooms as room
  join public.room_players as room_player
    on room_player.room_id = room.id
  where room.id = '00000000-0000-0000-0000-000000000922'
    and room_player.id = '00000000-0000-0000-0000-000000000925';

  if room_host_seat_id is distinct from room_player_id
    or room_player_id <> '00000000-0000-0000-0000-000000000925'
  then
    raise exception 'Host and anonymized roster identity diverged';
  end if;

  if not exists (
    select 1
    from public.game_states
    where id = '00000000-0000-0000-0000-000000000923'
      and state_data->'playerStates' ?
        '00000000-0000-0000-0000-000000000925'
      and state_data->'playerNames'
        ->>'00000000-0000-0000-0000-000000000925'
        = 'Deleted user'
  ) then
    raise exception 'game_states references were not anonymized';
  end if;

  if not exists (
    select 1
    from public.game_history
    where id = '00000000-0000-0000-0000-000000000924'
      and actor_seat_id = '00000000-0000-0000-0000-000000000925'
      and action_data->>'winnerSeatId'
        = '00000000-0000-0000-0000-000000000925'
      and action_data->'playerNames' ?
        '00000000-0000-0000-0000-000000000925'
      and action_data->'playerNames'
        ->>'00000000-0000-0000-0000-000000000925'
        = 'Deleted user'
  ) then
    raise exception 'game_history references were not anonymized';
  end if;

  result := public.anonymize_account_references(
    '00000000-0000-0000-0000-000000000921'
  );

  if result <> '{
    "anonymized_room_player_count": 0,
    "anonymized_room_count": 0,
    "anonymized_game_state_count": 0,
    "anonymized_game_history_count": 0
  }'::jsonb then
    raise exception 'Unexpected retry anonymization result: %', result;
  end if;

  if (
    select count(*)
    from meitra_private.account_anonymization_player_map
    where user_id = '00000000-0000-0000-0000-000000000921'
  ) <> 1 then
    raise exception 'Retry did not reuse the durable player mapping';
  end if;
end;
$$;

select pass('account anonymization preserves canonical seat identity');
select * from finish();

rollback;
