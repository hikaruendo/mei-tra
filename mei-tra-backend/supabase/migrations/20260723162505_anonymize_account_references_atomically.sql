create schema if not exists meitra_private;

create table meitra_private.account_anonymization_player_map (
  user_id uuid not null,
  room_id uuid not null,
  room_player_id uuid not null,
  original_player_id text not null,
  anonymized_player_id text not null,
  was_host boolean not null default false,
  created_at timestamp with time zone not null default now(),
  primary key (user_id, room_player_id),
  unique (room_player_id),
  unique (room_id, anonymized_player_id)
);

create unique index meitra_account_anonymization_host_map_key
  on meitra_private.account_anonymization_player_map (user_id, room_id)
  where was_host;

create or replace function meitra_private.scrub_account_references(
  p_value jsonb,
  p_player_id_map jsonb,
  p_in_player_names boolean default false
)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, public, meitra_private
as $function$
declare
  item record;
  scrubbed jsonb;
  next_is_player_names boolean;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return p_value;
  end if;

  if jsonb_typeof(p_value) = 'string' then
    return to_jsonb(
      coalesce(
        p_player_id_map ->> (p_value #>> '{}'),
        p_value #>> '{}'
      )
    );
  end if;

  if jsonb_typeof(p_value) = 'array' then
    select coalesce(
      jsonb_agg(
        meitra_private.scrub_account_references(value, p_player_id_map)
        order by ordinality
      ),
      '[]'::jsonb
    )
    into scrubbed
    from jsonb_array_elements(p_value) with ordinality;

    return scrubbed;
  end if;

  if jsonb_typeof(p_value) = 'object' then
    scrubbed := '{}'::jsonb;

    for item in select key, value from jsonb_each(p_value) loop
      next_is_player_names := p_in_player_names or item.key = 'playerNames';
      scrubbed := scrubbed || jsonb_build_object(
        coalesce(p_player_id_map ->> item.key, item.key),
        case
          when next_is_player_names and p_player_id_map ? item.key
            then to_jsonb('Deleted user'::text)
          else meitra_private.scrub_account_references(
            item.value,
            p_player_id_map,
            next_is_player_names
          )
        end
      );
    end loop;

    return scrubbed;
  end if;

  return p_value;
end;
$function$;

create or replace function public.anonymize_account_references(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, meitra_private
as $function$
declare
  account_deletion_started_at timestamp with time zone;
  anonymized_room_player_count bigint;
  anonymized_room_count bigint;
  anonymized_game_state_count bigint;
  anonymized_game_history_count bigint;
begin
  if p_user_id is null then
    raise exception 'account_anonymization_user_id_required';
  end if;

  select user_profile.account_deletion_started_at
  into account_deletion_started_at
  from public.user_profiles
    as user_profile
  where user_profile.id = p_user_id
  for update;

  if found and account_deletion_started_at is null then
    raise exception 'account_anonymization_not_started user=%', p_user_id;
  end if;

  insert into meitra_private.account_anonymization_player_map (
    user_id,
    room_id,
    room_player_id,
    original_player_id,
    anonymized_player_id,
    was_host
  )
  select
    p_user_id,
    room_player.room_id,
    room_player.id,
    room_player.player_id,
    'deleted-player-' || room_player.id::text,
    coalesce(room_player.is_host, false)
      or coalesce(room.host_id = p_user_id::text, false)
      or coalesce(room.host_id = room_player.player_id, false)
  from public.room_players as room_player
  left join public.rooms as room
    on room.id = room_player.room_id
  where room_player.user_id = p_user_id
  on conflict (user_id, room_player_id) do update
  set was_host = meitra_private.account_anonymization_player_map.was_host
    or excluded.was_host;

  if exists (
    select 1
    from public.rooms as room
    where room.host_id = p_user_id::text
      and not exists (
        select 1
        from meitra_private.account_anonymization_player_map as mapping
        where mapping.user_id = p_user_id
          and mapping.room_id = room.id
          and mapping.was_host
      )
  ) then
    raise exception 'account_anonymization_host_roster_missing user=%', p_user_id;
  end if;

  with room_maps as (
    select
      mapping.room_id,
      jsonb_object_agg(
        mapping.original_player_id,
        mapping.anonymized_player_id
      ) as player_id_map
    from meitra_private.account_anonymization_player_map as mapping
    where mapping.user_id = p_user_id
    group by mapping.room_id
  ),
  scrubbed_states as (
    select
      game_state.id,
      meitra_private.scrub_account_references(
        game_state.state_data,
        room_maps.player_id_map
      ) as state_data
    from public.game_states as game_state
    join room_maps on room_maps.room_id = game_state.room_id
  )
  update public.game_states as game_state
  set state_data = scrubbed_states.state_data
  from scrubbed_states
  where game_state.id = scrubbed_states.id
    and game_state.state_data is distinct from scrubbed_states.state_data;

  get diagnostics anonymized_game_state_count = row_count;

  with room_maps as (
    select
      mapping.room_id,
      jsonb_object_agg(
        mapping.original_player_id,
        mapping.anonymized_player_id
      ) as player_id_map
    from meitra_private.account_anonymization_player_map as mapping
    where mapping.user_id = p_user_id
    group by mapping.room_id
  ),
  scrubbed_history as (
    select
      history.id,
      meitra_private.scrub_account_references(
        history.action_data,
        room_maps.player_id_map
      ) as action_data,
      case
        when history.player_id is null then null
        else coalesce(
          room_maps.player_id_map ->> history.player_id,
          history.player_id
        )
      end as player_id
    from public.game_history as history
    join room_maps on room_maps.room_id = history.room_id
  )
  update public.game_history as history
  set
    action_data = scrubbed_history.action_data,
    player_id = scrubbed_history.player_id
  from scrubbed_history
  where history.id = scrubbed_history.id
    and (
      history.action_data is distinct from scrubbed_history.action_data
      or history.player_id is distinct from scrubbed_history.player_id
    );

  get diagnostics anonymized_game_history_count = row_count;

  update public.room_players as room_player
  set
    player_id = mapping.anonymized_player_id,
    user_id = null,
    socket_id = null,
    name = 'Deleted user',
    is_ready = false,
    is_host = false
  from meitra_private.account_anonymization_player_map as mapping
  where mapping.user_id = p_user_id
    and room_player.id = mapping.room_player_id
    and (
      room_player.player_id is distinct from mapping.anonymized_player_id
      or room_player.user_id is distinct from null
      or room_player.socket_id is distinct from null
      or room_player.name is distinct from 'Deleted user'
      or room_player.is_ready is distinct from false
      or room_player.is_host is distinct from false
    );

  get diagnostics anonymized_room_player_count = row_count;

  with host_targets as (
    select
      room.id,
      mapping.anonymized_player_id
    from public.rooms as room
    join meitra_private.account_anonymization_player_map as mapping
      on mapping.user_id = p_user_id
      and mapping.room_id = room.id
      and mapping.was_host
    where room.host_id in (
      p_user_id::text,
      mapping.original_player_id,
      mapping.anonymized_player_id
    )
  )
  update public.rooms as room
  set host_id = host_targets.anonymized_player_id
  from host_targets
  where room.id = host_targets.id
    and room.host_id is distinct from host_targets.anonymized_player_id;

  get diagnostics anonymized_room_count = row_count;

  if exists (
    select 1
    from public.rooms as room
    join meitra_private.account_anonymization_player_map as mapping
      on mapping.user_id = p_user_id
      and mapping.room_id = room.id
      and mapping.was_host
    where room.host_id is distinct from mapping.anonymized_player_id
      or not exists (
        select 1
        from public.room_players as room_player
        where room_player.id = mapping.room_player_id
          and room_player.room_id = room.id
          and room_player.player_id = mapping.anonymized_player_id
      )
  ) then
    raise exception 'account_anonymization_host_identity_mismatch user=%', p_user_id;
  end if;

  return jsonb_build_object(
    'anonymized_room_player_count', anonymized_room_player_count,
    'anonymized_room_count', anonymized_room_count,
    'anonymized_game_state_count', anonymized_game_state_count,
    'anonymized_game_history_count', anonymized_game_history_count
  );
end;
$function$;

revoke all on schema meitra_private from public, anon, authenticated, service_role;
revoke all on table meitra_private.account_anonymization_player_map
  from public, anon, authenticated, service_role;
revoke all on function meitra_private.scrub_account_references(jsonb, jsonb, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.anonymize_account_references(uuid)
  from public, anon, authenticated;
grant execute on function public.anonymize_account_references(uuid)
  to service_role;

select pg_notify('pgrst', 'reload schema');
