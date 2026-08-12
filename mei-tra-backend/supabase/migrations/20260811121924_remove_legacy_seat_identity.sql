create or replace function meitra_private.canonicalize_state_identity_json(
  p_value jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, meitra_private
as $function$
declare
  item record;
  canonical_value jsonb;
  canonical_object jsonb := '{}'::jsonb;
  alias_pair text[];
  alias_pairs constant text[][] := array[
    array['playerId', 'seatId'],
    array['currentPlayerId', 'currentSeatId'],
    array['lastPasser', 'lastPasserSeatId'],
    array['negriPlayerId', 'negriSeatId'],
    array['playedBy', 'playedBySeatIds'],
    array['dealerId', 'dealerSeatId'],
    array['winnerId', 'winnerSeatId'],
    array['lastWinnerId', 'lastWinnerSeatId'],
    array['openDeclarerId', 'openDeclarerSeatId']
  ];
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return p_value;
  end if;

  if jsonb_typeof(p_value) = 'array' then
    select coalesce(
      jsonb_agg(
        meitra_private.canonicalize_state_identity_json(value)
        order by ordinality
      ),
      '[]'::jsonb
    )
    into canonical_value
    from jsonb_array_elements(p_value) with ordinality;

    return canonical_value;
  end if;

  if jsonb_typeof(p_value) <> 'object' then
    return p_value;
  end if;

  for item in select key, value from jsonb_each(p_value) loop
    if item.key not in (
      'playerId',
      'currentPlayerId',
      'lastPasser',
      'negriPlayerId',
      'playedBy',
      'dealerId',
      'winnerId',
      'lastWinnerId',
      'openDeclarerId'
    ) then
      canonical_object := canonical_object || jsonb_build_object(
        item.key,
        meitra_private.canonicalize_state_identity_json(item.value)
      );
    end if;
  end loop;

  foreach alias_pair slice 1 in array alias_pairs loop
    if p_value ? alias_pair[1]
      and not p_value ? alias_pair[2] then
      canonical_object := canonical_object || jsonb_build_object(
        alias_pair[2],
        meitra_private.canonicalize_state_identity_json(
          p_value->alias_pair[1]
        )
      );
    end if;
  end loop;

  return canonical_object;
end;
$function$;

revoke all on function meitra_private.canonicalize_state_identity_json(jsonb)
  from public;
grant execute on function meitra_private.canonicalize_state_identity_json(jsonb)
  to service_role;

create or replace function meitra_private.state_identity_references(
  p_value jsonb,
  p_parent_key text default null
)
returns setof text
language plpgsql
immutable
set search_path = pg_catalog, meitra_private
as $function$
declare
  item record;
  array_item jsonb;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return;
  end if;

  if jsonb_typeof(p_value) = 'array' then
    for array_item in select value from jsonb_array_elements(p_value) loop
      return query
      select *
      from meitra_private.state_identity_references(
        array_item,
        p_parent_key
      );
    end loop;
    return;
  end if;

  if jsonb_typeof(p_value) <> 'object' then
    return;
  end if;

  for item in select key, value from jsonb_each(p_value) loop
    if p_parent_key in (
      'playerStates',
      'playerNames',
      'neguri',
      'teamAssignments',
      'startingHandsByPlayerId',
      'startingHandsBySeatId'
    ) then
      return next item.key;
    end if;

    if item.key in (
      'seatId',
      'playerId',
      'currentSeatId',
      'currentPlayerId',
      'currentTurnPlayerId',
      'lastPasserSeatId',
      'lastPasser',
      'negriSeatId',
      'negriPlayerId',
      'dealerSeatId',
      'dealerId',
      'winnerSeatId',
      'winnerId',
      'winnerPlayerId',
      'lastWinnerSeatId',
      'lastWinnerId',
      'openDeclarerSeatId',
      'openDeclarerId',
      'firstBlowPlayerId',
      'startedByPlayerId',
      'nextDealerPlayerId',
      'nextDealerId',
      'nextPlayerId'
    ) and jsonb_typeof(item.value) = 'string' then
      return next item.value #>> '{}';
    elsif item.key in (
      'playedBySeatIds',
      'updatedPlayers',
      'skippedPlayers'
    )
      and jsonb_typeof(item.value) = 'array' then
      for array_item in select value from jsonb_array_elements(item.value) loop
        if jsonb_typeof(array_item) = 'string' then
          return next array_item #>> '{}';
        end if;
      end loop;
    end if;

    return query
    select *
    from meitra_private.state_identity_references(item.value, item.key);
  end loop;
end;
$function$;

create or replace function meitra_private.assert_state_identity_references(
  p_room_id uuid,
  p_value jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  invalid_reference text;
begin
  select reference.seat_id
  into invalid_reference
  from meitra_private.state_identity_references(p_value) as reference(seat_id)
  where reference.seat_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or not exists (
      select 1
      from public.room_players as room_player
      where room_player.room_id = p_room_id
        and room_player.id::text = reference.seat_id
    )
  limit 1;

  if invalid_reference is not null then
    raise exception 'state_seat_not_in_room room=% seat=%',
      p_room_id,
      invalid_reference
      using errcode = 'PT422';
  end if;
end;
$function$;

revoke all on function meitra_private.state_identity_references(jsonb, text)
  from public;
revoke all on function meitra_private.assert_state_identity_references(
  uuid,
  jsonb
) from public;
grant execute on function meitra_private.state_identity_references(jsonb, text)
  to service_role;
grant execute on function meitra_private.assert_state_identity_references(
  uuid,
  jsonb
) to service_role;

create or replace function meitra_private.remap_legacy_state_identity_references(
  p_room_id uuid,
  p_value jsonb,
  p_parent_key text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  item record;
  array_item jsonb;
  remapped_object jsonb := '{}'::jsonb;
  remapped_array jsonb := '[]'::jsonb;
  output_key text;
  output_value jsonb;
  identity_key text;
  resolved_seat_id uuid;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return p_value;
  end if;

  if jsonb_typeof(p_value) = 'array' then
    for array_item in select value from jsonb_array_elements(p_value) loop
      remapped_array := remapped_array || jsonb_build_array(
        meitra_private.remap_legacy_state_identity_references(
          p_room_id,
          array_item,
          p_parent_key
        )
      );
    end loop;

    return remapped_array;
  end if;

  if jsonb_typeof(p_value) <> 'object' then
    return p_value;
  end if;

  for item in select key, value from jsonb_each(p_value) loop
    output_key := item.key;

    if p_parent_key in (
      'playerStates',
      'playerNames',
      'neguri',
      'teamAssignments',
      'startingHandsByPlayerId',
      'startingHandsBySeatId'
    ) then
      resolved_seat_id := meitra_private.resolve_room_seat_id(
        p_room_id,
        item.key,
        null
      );

      if resolved_seat_id is null then
        raise exception 'legacy_state_seat_is_unresolved room=% identity=%',
          p_room_id,
          item.key
          using errcode = 'PT422';
      end if;

      output_key := resolved_seat_id::text;

      if remapped_object ? output_key then
        raise exception 'legacy_state_seat_key_collision room=% seat=%',
          p_room_id,
          output_key
          using errcode = 'PT422';
      end if;
    end if;

    if item.key in (
      'seatId',
      'playerId',
      'currentSeatId',
      'currentPlayerId',
      'currentTurnPlayerId',
      'lastPasserSeatId',
      'lastPasser',
      'negriSeatId',
      'negriPlayerId',
      'dealerSeatId',
      'dealerId',
      'winnerSeatId',
      'winnerId',
      'winnerPlayerId',
      'lastWinnerSeatId',
      'lastWinnerId',
      'openDeclarerSeatId',
      'openDeclarerId',
      'firstBlowPlayerId',
      'startedByPlayerId',
      'nextDealerPlayerId',
      'nextDealerId',
      'nextPlayerId'
    ) then
      if jsonb_typeof(item.value) = 'null' then
        output_value := item.value;
      elsif jsonb_typeof(item.value) <> 'string' then
        raise exception 'legacy_state_seat_has_invalid_type room=% field=%',
          p_room_id,
          item.key
          using errcode = 'PT422';
      else
        identity_key := item.value #>> '{}';
        resolved_seat_id := meitra_private.resolve_room_seat_id(
          p_room_id,
          identity_key,
          null
        );

        if resolved_seat_id is null then
          raise exception 'legacy_state_seat_is_unresolved room=% identity=%',
            p_room_id,
            identity_key
            using errcode = 'PT422';
        end if;

        output_value := to_jsonb(resolved_seat_id::text);
      end if;
    elsif item.key in (
      'playedBySeatIds',
      'updatedPlayers',
      'skippedPlayers'
    ) then
      if jsonb_typeof(item.value) = 'null' then
        output_value := item.value;
      elsif jsonb_typeof(item.value) <> 'array' then
        raise exception 'legacy_state_seat_array_has_invalid_type room=% field=%',
          p_room_id,
          item.key
          using errcode = 'PT422';
      else
        output_value := '[]'::jsonb;

        for array_item in select value from jsonb_array_elements(item.value) loop
          if jsonb_typeof(array_item) <> 'string' then
            raise exception 'legacy_state_seat_array_item_has_invalid_type room=% field=%',
              p_room_id,
              item.key
              using errcode = 'PT422';
          end if;

          identity_key := array_item #>> '{}';
          resolved_seat_id := meitra_private.resolve_room_seat_id(
            p_room_id,
            identity_key,
            null
          );

          if resolved_seat_id is null then
            raise exception 'legacy_state_seat_is_unresolved room=% identity=%',
              p_room_id,
              identity_key
              using errcode = 'PT422';
          end if;

          output_value := output_value || jsonb_build_array(
            resolved_seat_id::text
          );
        end loop;
      end if;
    else
      output_value := meitra_private.remap_legacy_state_identity_references(
        p_room_id,
        item.value,
        item.key
      );
    end if;

    remapped_object := remapped_object || jsonb_build_object(
      output_key,
      output_value
    );
  end loop;

  return remapped_object;
end;
$function$;

revoke all on function meitra_private.remap_legacy_state_identity_references(
  uuid,
  jsonb,
  text
) from public, anon, authenticated;

with host_candidates as (
  select distinct on (room_player.room_id)
    room_player.room_id,
    room_player.id as seat_id
  from public.room_players as room_player
  order by
    room_player.room_id,
    room_player.is_host desc,
    room_player.seat_index,
    room_player.joined_at
)
update public.rooms as room
set host_seat_id = host_candidates.seat_id
from host_candidates
where room.id = host_candidates.room_id
  and room.host_seat_id is null;

update public.active_room_memberships
set seat_id = player_id::uuid
where seat_id is null
  and room_id is null
  and player_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

do $legacy_cleanup_preflight$
begin
  if exists (
    select 1
    from public.game_states as game_state
    join public.rooms as room on room.id = game_state.room_id
    where room.status in ('waiting', 'ready', 'playing')
      and (
        game_state.state_data->>'identitySchemaVersion' is distinct from '2'
        or game_state.state_data ? 'players'
        or game_state.state_data ? 'playerOrder'
        or game_state.state_data ? 'teamAssignments'
      )
  ) then
    raise exception 'legacy_cleanup_active_game_state_is_not_v2'
      using errcode = 'PT422';
  end if;

  if exists (
    select 1
    from public.game_states as game_state
    join public.rooms as room on room.id = game_state.room_id
    cross join lateral meitra_private.state_identity_references(
      meitra_private.remap_legacy_state_identity_references(
        game_state.room_id,
        meitra_private.canonicalize_state_identity_json(game_state.state_data)
      )
    ) as reference(seat_id)
    where room.status in ('waiting', 'ready', 'playing')
      and (
        reference.seat_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or not exists (
          select 1
          from public.room_players as room_player
          where room_player.room_id = game_state.room_id
            and room_player.id::text = reference.seat_id
        )
      )
  ) then
    raise exception 'legacy_cleanup_active_state_seat_is_unresolved'
      using errcode = 'PT422';
  end if;
end;
$legacy_cleanup_preflight$;

update public.game_states as game_state
set state_data = jsonb_set(
  meitra_private.remap_legacy_state_identity_references(
    game_state.room_id,
    meitra_private.canonicalize_state_identity_json(
      coalesce(game_state.state_data, '{}'::jsonb)
    )
      - 'players'
      - 'playerOrder'
      - 'teamAssignments'
  ),
  '{identitySchemaVersion}',
  '2'::jsonb,
  true
)
where true;

update public.game_history as history
set action_data = meitra_private.remap_legacy_state_identity_references(
  history.room_id,
  coalesce(history.action_data, '{}'::jsonb)
)
where true;

drop function meitra_private.remap_legacy_state_identity_references(
  uuid,
  jsonb,
  text
);

do $legacy_cleanup_guard$
begin
  if exists (
    select 1
    from public.rooms
    where host_seat_id is null
  ) then
    raise exception 'legacy_cleanup_room_host_is_unresolved'
      using errcode = 'PT422';
  end if;

  if exists (
    select 1
    from public.active_room_memberships
    where seat_id is null
  ) then
    raise exception 'legacy_cleanup_active_membership_seat_is_unresolved'
      using errcode = 'PT422';
  end if;

  if exists (
    select 1
    from public.game_states as game_state
    join public.rooms as room on room.id = game_state.room_id
    where room.status in ('waiting', 'ready', 'playing')
      and (
        game_state.state_data->>'identitySchemaVersion' is distinct from '2'
        or game_state.state_data ? 'players'
        or game_state.state_data ? 'playerOrder'
        or game_state.state_data ? 'teamAssignments'
        or jsonb_path_exists(game_state.state_data, '$.**.playerId')
        or jsonb_path_exists(game_state.state_data, '$.**.currentPlayerId')
        or jsonb_path_exists(game_state.state_data, '$.**.lastPasser')
        or jsonb_path_exists(game_state.state_data, '$.**.negriPlayerId')
        or jsonb_path_exists(game_state.state_data, '$.**.playedBy')
        or jsonb_path_exists(game_state.state_data, '$.**.dealerId')
        or jsonb_path_exists(game_state.state_data, '$.**.winnerId')
        or jsonb_path_exists(game_state.state_data, '$.**.lastWinnerId')
        or jsonb_path_exists(game_state.state_data, '$.**.openDeclarerId')
      )
  ) then
    raise exception 'legacy_cleanup_active_game_state_is_not_v2'
      using errcode = 'PT422';
  end if;

  if exists (
    select 1
    from public.game_states as game_state
    join public.rooms as room on room.id = game_state.room_id
    cross join lateral jsonb_object_keys(
      coalesce(game_state.state_data->'playerStates', '{}'::jsonb)
    ) as player_state(seat_id)
    where room.status in ('waiting', 'ready', 'playing')
      and not exists (
        select 1
        from public.room_players as room_player
        where room_player.room_id = game_state.room_id
          and room_player.id::text = player_state.seat_id
      )
  ) then
    raise exception 'legacy_cleanup_active_player_state_seat_is_unresolved'
      using errcode = 'PT422';
  end if;

  if exists (
    select 1
    from public.game_history as history
    cross join lateral meitra_private.state_identity_references(
      history.action_data
    ) as reference(seat_id)
    where reference.seat_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not exists (
        select 1
        from public.room_players as room_player
        where room_player.room_id = history.room_id
          and room_player.id::text = reference.seat_id
      )
  ) then
    raise exception 'legacy_cleanup_game_history_seat_is_unresolved'
      using errcode = 'PT422';
  end if;
end;
$legacy_cleanup_guard$;

drop trigger if exists sync_active_room_membership_seat
  on public.active_room_memberships;
drop trigger if exists sync_room_membership_event_seat
  on public.room_membership_events;
drop trigger if exists sync_game_history_actor_seat
  on public.game_history;
drop trigger if exists sync_game_state_current_seat_identity
  on public.game_states;
drop trigger if exists sync_room_host_seat_identity
  on public.rooms;
drop trigger if exists keep_anonymized_host_on_seat_id
  on meitra_private.account_anonymization_player_map;
drop trigger if exists reject_deleting_room_host
  on public.rooms;

create or replace function meitra_private.canonicalize_player_states(
  p_room_id uuid,
  p_player_states jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  state_entry record;
  seat_id uuid;
  canonical_states jsonb := '{}'::jsonb;
begin
  for state_entry in
    select key, value
    from jsonb_each(coalesce(p_player_states, '{}'::jsonb))
  loop
    begin
      seat_id := state_entry.key::uuid;
    exception when invalid_text_representation then
      raise exception 'player_state_seat_id_invalid room=% seat=%',
        p_room_id,
        state_entry.key
        using errcode = 'PT422';
    end;

    if not exists (
      select 1
      from public.room_players
      where room_id = p_room_id
        and id = seat_id
    ) then
      raise exception 'player_state_seat_not_in_room room=% seat=%',
        p_room_id,
        seat_id
        using errcode = 'PT422';
    end if;

    canonical_states := canonical_states || jsonb_build_object(
      seat_id::text,
      state_entry.value
    );
  end loop;

  return canonical_states;
end;
$function$;

create or replace function public.mark_account_deletion_started(p_user_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  profile public.user_profiles%rowtype;
begin
  if p_user_id is null then
    raise exception 'account_deletion_user_id_required';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('meitra-account-room-membership'),
    hashtext(p_user_id::text)
  );

  if exists (
    select 1
    from public.room_players as room_player
    join public.rooms as room
      on room.id = room_player.room_id
    where room_player.user_id = p_user_id
      and room.status in ('waiting', 'ready', 'playing')
  ) then
    raise exception 'account_deletion_blocked user=%', p_user_id
      using errcode = 'PT409';
  end if;

  update public.user_profiles
  set account_deletion_started_at = coalesce(
    account_deletion_started_at,
    now()
  )
  where id = p_user_id
  returning * into profile;

  if not found then
    return null;
  end if;

  return to_jsonb(profile);
end;
$function$;

create or replace function public.reject_deleting_room_host()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  host_user_id uuid;
begin
  if new.host_seat_id is null then
    return new;
  end if;

  select user_id
  into host_user_id
  from public.room_players
  where room_id = new.id
    and id = new.host_seat_id;

  if host_user_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtext('meitra-account-room-membership'),
    hashtext(host_user_id::text)
  );

  if exists (
    select 1
    from public.user_profiles
    where id = host_user_id
      and account_deletion_started_at is not null
  ) then
    raise exception 'account_deletion_in_progress host=%', host_user_id
      using errcode = 'PT403';
  end if;

  return new;
end;
$function$;

create or replace function meitra_private.scrub_account_player_names(
  p_value jsonb,
  p_seat_ids jsonb,
  p_in_player_names boolean default false
)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, meitra_private
as $function$
declare
  item record;
  scrubbed jsonb;
  next_is_player_names boolean;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return p_value;
  end if;

  if jsonb_typeof(p_value) = 'array' then
    select coalesce(
      jsonb_agg(
        meitra_private.scrub_account_player_names(
          value,
          p_seat_ids,
          p_in_player_names
        )
        order by ordinality
      ),
      '[]'::jsonb
    )
    into scrubbed
    from jsonb_array_elements(p_value) with ordinality;

    return scrubbed;
  end if;

  if jsonb_typeof(p_value) <> 'object' then
    return p_value;
  end if;

  scrubbed := '{}'::jsonb;
  for item in select key, value from jsonb_each(p_value) loop
    next_is_player_names := p_in_player_names or item.key = 'playerNames';
    scrubbed := scrubbed || jsonb_build_object(
      item.key,
      case
        when next_is_player_names and p_seat_ids ? item.key
          then to_jsonb('Deleted user'::text)
        else meitra_private.scrub_account_player_names(
          item.value,
          p_seat_ids,
          next_is_player_names
        )
      end
    );
  end loop;

  return scrubbed;
end;
$function$;

revoke all on function meitra_private.scrub_account_player_names(
  jsonb,
  jsonb,
  boolean
) from public;
grant execute on function meitra_private.scrub_account_player_names(
  jsonb,
  jsonb,
  boolean
) to service_role;

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
  from public.user_profiles as user_profile
  where user_profile.id = p_user_id
  for update;

  if found and account_deletion_started_at is null then
    raise exception 'account_anonymization_not_started user=%', p_user_id;
  end if;

  insert into meitra_private.account_anonymization_player_map (
    user_id,
    room_id,
    room_player_id,
    was_host
  )
  select
    p_user_id,
    room_player.room_id,
    room_player.id,
    room.host_seat_id = room_player.id
  from public.room_players as room_player
  join public.rooms as room
    on room.id = room_player.room_id
  where room_player.user_id = p_user_id
  on conflict (user_id, room_player_id) do update
  set
    was_host = meitra_private.account_anonymization_player_map.was_host
      or excluded.was_host;

  anonymized_room_count := 0;

  with room_maps as (
    select
      mapping.room_id,
      jsonb_object_agg(
        mapping.room_player_id::text,
        true
      ) as seat_ids
    from meitra_private.account_anonymization_player_map as mapping
    where mapping.user_id = p_user_id
    group by mapping.room_id
  ),
  scrubbed_states as (
    select
      game_state.id,
      meitra_private.scrub_account_player_names(
        game_state.state_data,
        room_maps.seat_ids
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
        mapping.room_player_id::text,
        true
      ) as seat_ids
    from meitra_private.account_anonymization_player_map as mapping
    where mapping.user_id = p_user_id
    group by mapping.room_id
  ),
  scrubbed_history as (
    select
      history.id,
      meitra_private.scrub_account_player_names(
        history.action_data,
        room_maps.seat_ids
      ) as action_data
    from public.game_history as history
    join room_maps on room_maps.room_id = history.room_id
  )
  update public.game_history as history
  set action_data = scrubbed_history.action_data
  from scrubbed_history
  where history.id = scrubbed_history.id
    and history.action_data is distinct from scrubbed_history.action_data;

  get diagnostics anonymized_game_history_count = row_count;

  update public.room_players as room_player
  set
    user_id = null,
    name = 'Deleted user',
    is_ready = false
  from meitra_private.account_anonymization_player_map as mapping
  where mapping.user_id = p_user_id
    and room_player.id = mapping.room_player_id
    and (
      room_player.user_id is not null
      or room_player.name is distinct from 'Deleted user'
      or room_player.is_ready is distinct from false
    );

  get diagnostics anonymized_room_player_count = row_count;

  if exists (
    select 1
    from public.rooms as room
    join meitra_private.account_anonymization_player_map as mapping
      on mapping.user_id = p_user_id
      and mapping.room_id = room.id
      and mapping.was_host
    where room.host_seat_id is distinct from mapping.room_player_id
      or not exists (
        select 1
        from public.room_players as room_player
        where room_player.id = mapping.room_player_id
          and room_player.room_id = room.id
          and room_player.user_id is null
          and room_player.name = 'Deleted user'
      )
  ) then
    raise exception 'account_anonymization_host_identity_mismatch user=%',
      p_user_id;
  end if;

  return jsonb_build_object(
    'anonymized_room_player_count', anonymized_room_player_count,
    'anonymized_room_count', anonymized_room_count,
    'anonymized_game_state_count', anonymized_game_state_count,
    'anonymized_game_history_count', anonymized_game_history_count
  );
end;
$function$;

drop function if exists meitra_private.scrub_account_references(
  jsonb,
  jsonb,
  boolean
);

alter table meitra_private.account_anonymization_player_map
  drop constraint if exists account_anonymization_player_map_room_player_id_key,
  drop column original_player_id,
  drop column anonymized_player_id;

do $persist_roster_cleanup$
begin
  execute $sql$
create or replace function public.persist_room_roster_atomic(
  p_room_id uuid,
  p_room_players jsonb,
  p_player_states jsonb,
  p_host_id text default null,
  p_expected_version bigint default null,
  p_state_patch jsonb default '{}'::jsonb,
  p_scalar_patch jsonb default '{}'::jsonb,
  p_membership_mutation jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  current_state public.game_states%rowtype;
  updated_state public.game_states%rowtype;
  player_entry jsonb;
  requested_seat_identity text;
  requested_seat_id uuid;
  existing_room_id uuid;
  incoming_seat_ids uuid[] := array[]::uuid[];
  player_seat_index integer;
  player_user_id uuid;
  canonical_player_states jsonb;
  canonical_state_patch jsonb;
  next_host_seat_id uuid;
  next_current_seat_id uuid;
  requested_current_identity text;
  lock_user_id uuid;
  mutation_type text;
  mutation_result jsonb;
  membership_mutation_applied boolean := false;
  upserted_count integer;
begin
  mutation_type := p_membership_mutation->>'type';
  if mutation_type is not null and mutation_type not in (
    'claim',
    'release',
    'complete-disconnect-timeout'
  ) then
    raise exception 'unsupported_roster_membership_mutation type=%',
      mutation_type
      using errcode = 'PT422';
  end if;

  if mutation_type = 'claim' and (
    nullif(p_membership_mutation->>'userId', '') is null
    or nullif(p_membership_mutation->>'transitionId', '') is null
  ) then
    raise exception 'claim_membership_mutation_is_incomplete'
      using errcode = 'PT422';
  end if;

  if mutation_type = 'release' and (
    nullif(p_membership_mutation->>'seatId', '') is null
    or nullif(p_membership_mutation->>'transitionId', '') is null
  ) then
    raise exception 'release_membership_mutation_is_incomplete'
      using errcode = 'PT422';
  end if;

  if mutation_type = 'complete-disconnect-timeout' and (
    nullif(p_membership_mutation->>'userId', '') is null
    or nullif(p_membership_mutation->>'expectedVersion', '') is null
    or nullif(p_membership_mutation->>'transitionId', '') is null
  ) then
    raise exception 'disconnect_membership_mutation_is_incomplete'
      using errcode = 'PT422';
  end if;

  for lock_user_id in
    select distinct nullif(player->>'userId', '')::uuid
    from jsonb_array_elements(coalesce(p_room_players, '[]'::jsonb)) as player
    where nullif(player->>'userId', '') is not null
    order by 1
  loop
    perform pg_advisory_xact_lock(
      hashtext('meitra-account-room-membership'),
      hashtext(lock_user_id::text)
    );
  end loop;

  select *
  into current_state
  from public.game_states
  where room_id = p_room_id
  for update;

  if not found then
    return null;
  end if;

  if p_expected_version is not null
    and current_state.version <> p_expected_version then
    raise exception 'game_state_version_conflict room=% expected=% actual=%',
      p_room_id,
      p_expected_version,
      current_state.version
      using errcode = 'PT409';
  end if;

  if exists (
    select 1
    from (
      select (entry->>'seatIndex')::integer as seat_index, count(*)
      from jsonb_array_elements(coalesce(p_room_players, '[]'::jsonb)) as entry
      group by (entry->>'seatIndex')::integer
      having count(*) > 1
    ) as duplicate_seats
  ) then
    raise exception 'duplicate_roster_seat_index room=%', p_room_id
      using errcode = 'PT422';
  end if;

  for player_entry in
    select value
    from jsonb_array_elements(coalesce(p_room_players, '[]'::jsonb))
  loop
    if player_entry->>'seatIndex' is null then
      raise exception 'roster_seat_index_required room=%', p_room_id
        using errcode = 'PT422';
    end if;

    player_seat_index := (player_entry->>'seatIndex')::integer;
    requested_seat_identity := nullif(
      coalesce(player_entry->>'seatId', player_entry->>'playerId'),
      ''
    );

    if requested_seat_identity is null then
      raise exception 'roster_seat_id_required room=% seatIndex=%',
        p_room_id,
        player_seat_index
        using errcode = 'PT422';
    end if;

    begin
      requested_seat_id := requested_seat_identity::uuid;
    exception when invalid_text_representation then
      raise exception 'invalid_roster_seat_id room=% seat=%',
        p_room_id,
        requested_seat_identity
        using errcode = 'PT422';
    end;

    existing_room_id := null;
    select room_id
    into existing_room_id
    from public.room_players
    where id = requested_seat_id
    for update;

    if found and existing_room_id <> p_room_id then
      raise exception 'roster_seat_belongs_to_other_room room=% seat=%',
        p_room_id,
        requested_seat_id
        using errcode = 'PT422';
    end if;

    if not found and exists (
      select 1
      from public.room_players
      where room_id = p_room_id
        and seat_index = player_seat_index
    ) then
      raise exception 'roster_cannot_replace_existing_seat_uuid room=% seatIndex=% requested=%',
        p_room_id,
        player_seat_index,
        requested_seat_id
        using errcode = 'PT422';
    end if;

    if requested_seat_id = any(incoming_seat_ids) then
      raise exception 'duplicate_roster_seat_id room=% seat=%',
        p_room_id,
        requested_seat_id
        using errcode = 'PT422';
    end if;

    player_user_id := nullif(player_entry->>'userId', '')::uuid;

    insert into public.room_players (
      id,
      room_id,
      user_id,
      name,
      team,
      is_ready,
      is_com,
      joined_at,
      seat_index
    ) values (
      requested_seat_id,
      p_room_id,
      player_user_id,
      player_entry->>'name',
      (player_entry->>'team')::integer,
      coalesce((player_entry->>'isReady')::boolean, false),
      coalesce((player_entry->>'isCOM')::boolean, false),
      coalesce((player_entry->>'joinedAt')::timestamptz, now()),
      player_seat_index
    )
    on conflict (id) do update
    set
      user_id = excluded.user_id,
      name = excluded.name,
      team = excluded.team,
      is_ready = excluded.is_ready,
      is_com = excluded.is_com,
      joined_at = excluded.joined_at,
      seat_index = excluded.seat_index
    where room_players.room_id = excluded.room_id;

    get diagnostics upserted_count = row_count;
    if upserted_count <> 1 then
      raise exception 'roster_seat_upsert_rejected room=% seat=% index=%',
        p_room_id,
        requested_seat_id,
        player_seat_index
        using errcode = 'PT409';
    end if;

    incoming_seat_ids := array_append(incoming_seat_ids, requested_seat_id);

    if player_user_id is not null then
      if mutation_type = 'claim'
        and p_membership_mutation->>'userId' = player_user_id::text then
        mutation_result := public.claim_room_membership(
          player_user_id,
          p_room_id,
          requested_seat_id::text,
          (p_membership_mutation->>'transitionId')::uuid
        );
        if mutation_result->>'result' = 'conflict' then
          raise exception 'active_room_membership_conflict user=% room=%',
            player_user_id,
            p_room_id
            using errcode = 'PT409';
        end if;
        membership_mutation_applied := true;
      end if;

      update public.active_room_memberships
      set seat_id = requested_seat_id
      where user_id = player_user_id
        and room_id = p_room_id;

      update public.room_membership_events
      set seat_id = requested_seat_id
      where user_id = player_user_id
        and seat_id is null
        and (
          from_room_id = p_room_id
          or to_room_id = p_room_id
        );
    end if;
  end loop;

  if exists (
    select 1
    from public.room_players as existing_seat
    where existing_seat.room_id = p_room_id
      and not (existing_seat.id = any(incoming_seat_ids))
  ) then
    raise exception 'roster_cannot_remove_existing_seat room=%', p_room_id
      using errcode = 'PT422';
  end if;

  if mutation_type = 'release' then
    perform public.release_room_membership_by_player(
      p_room_id,
      p_membership_mutation->>'seatId',
      (p_membership_mutation->>'transitionId')::uuid
    );
    membership_mutation_applied := true;
  elsif mutation_type = 'complete-disconnect-timeout' then
    mutation_result := public.finish_room_membership_timeout(
      (p_membership_mutation->>'userId')::uuid,
      p_room_id,
      (p_membership_mutation->>'expectedVersion')::bigint,
      (p_membership_mutation->>'transitionId')::uuid,
      true
    );
    if mutation_result->>'result' <> 'completed' then
      raise exception 'disconnect_timeout_membership_stale user=% room=%',
        p_membership_mutation->>'userId',
        p_room_id
        using errcode = 'PT409';
    end if;
    membership_mutation_applied := true;
  end if;

  if mutation_type is not null and not membership_mutation_applied then
    raise exception 'roster_membership_mutation_not_applied type=% room=%',
      mutation_type,
      p_room_id
      using errcode = 'PT422';
  end if;

  if p_host_id is null then
    select host_seat_id
    into next_host_seat_id
    from public.rooms
    where id = p_room_id;
  else
    begin
      next_host_seat_id := p_host_id::uuid;
    exception when invalid_text_representation then
      raise exception 'host_seat_id_invalid room=% seat=%', p_room_id, p_host_id
        using errcode = 'PT422';
    end;
  end if;

  if next_host_seat_id is null or not exists (
    select 1
    from public.room_players
    where room_id = p_room_id
      and id = next_host_seat_id
  ) then
    raise exception 'host_seat_not_in_room room=% seat=%',
      p_room_id,
      next_host_seat_id
      using errcode = 'PT422';
  end if;

  update public.rooms
  set
    host_seat_id = next_host_seat_id,
    last_activity_at = now()
  where id = p_room_id;

  canonical_player_states := meitra_private.canonicalize_player_states(
    p_room_id,
    p_player_states
  );

  next_current_seat_id := current_state.current_seat_id;
  if p_scalar_patch ? 'currentSeatId'
    or p_scalar_patch ? 'currentPlayerId' then
    requested_current_identity := nullif(
      coalesce(
        p_scalar_patch->>'currentSeatId',
        p_scalar_patch->>'currentPlayerId'
      ),
      ''
    );

    if requested_current_identity is null then
      next_current_seat_id := null;
    else
      begin
        next_current_seat_id := requested_current_identity::uuid;
      exception when invalid_text_representation then
        raise exception 'current_seat_id_invalid room=% seat=%',
          p_room_id,
          requested_current_identity
          using errcode = 'PT422';
      end;

      if not exists (
        select 1
        from public.room_players
        where room_id = p_room_id
          and id = next_current_seat_id
      ) then
        raise exception 'current_seat_not_in_room room=% seat=%',
          p_room_id,
          next_current_seat_id
          using errcode = 'PT422';
      end if;
    end if;
  end if;

  if next_current_seat_id is not null
    and not (next_current_seat_id = any(incoming_seat_ids)) then
    raise exception 'current_seat_removed_from_roster room=% seat=%',
      p_room_id,
      next_current_seat_id
      using errcode = 'PT422';
  end if;

  canonical_state_patch := meitra_private.canonicalize_state_identity_json(
    coalesce(p_state_patch, '{}'::jsonb)
  )
    - 'players'
    - 'playerOrder'
    - 'teamAssignments'
    - 'playerStates'
    - 'identitySchemaVersion';

  perform meitra_private.assert_state_identity_references(
    p_room_id,
    canonical_state_patch
  );

  update public.game_states
  set
    state_data = (coalesce(current_state.state_data, '{}'::jsonb)
      - 'players'
      - 'playerOrder'
      - 'teamAssignments')
      || canonical_state_patch
      || jsonb_build_object(
        'identitySchemaVersion', 2,
        'playerStates', canonical_player_states
      ),
    current_seat_id = next_current_seat_id,
    game_phase = case
      when p_scalar_patch ? 'gamePhase'
        then (p_scalar_patch->>'gamePhase')::game_phase
      else current_state.game_phase
    end,
    round_number = case
      when p_scalar_patch ? 'roundNumber'
        then (p_scalar_patch->>'roundNumber')::integer
      else current_state.round_number
    end,
    points_to_win = case
      when p_scalar_patch ? 'pointsToWin'
        then (p_scalar_patch->>'pointsToWin')::integer
      else current_state.points_to_win
    end,
    team_scores = case
      when p_scalar_patch ? 'teamScores'
        then p_scalar_patch->'teamScores'
      else current_state.team_scores
    end,
    team_score_records = case
      when p_scalar_patch ? 'teamScoreRecords'
        then p_scalar_patch->'teamScoreRecords'
      else current_state.team_score_records
    end,
    version = current_state.version + 1
  where room_id = p_room_id
  returning * into updated_state;

  return to_jsonb(updated_state) || jsonb_build_object(
    'roomPlayers', coalesce(
      (
        select jsonb_agg(to_jsonb(room_player) order by room_player.seat_index)
        from public.room_players as room_player
        where room_player.room_id = p_room_id
      ),
      '[]'::jsonb
    )
  );
end;
$function$;
  $sql$;
end;
$persist_roster_cleanup$;

do $atomic_state_cleanup$
begin
  execute $sql$
create or replace function public.atomic_update_game_state(
  p_room_id uuid,
  p_state_patch jsonb default '{}'::jsonb,
  p_scalar_patch jsonb default '{}'::jsonb,
  p_expected_version bigint default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  current_state public.game_states%rowtype;
  updated_state public.game_states%rowtype;
  requested_current_identity text;
  next_current_seat_id uuid;
  canonical_state_patch jsonb;
begin
  select *
  into current_state
  from public.game_states
  where room_id = p_room_id
  for update;

  if not found then
    return null;
  end if;

  if p_expected_version is not null
    and current_state.version <> p_expected_version then
    raise exception 'game_state_version_conflict room=% expected=% actual=%',
      p_room_id,
      p_expected_version,
      current_state.version
      using errcode = 'PT409';
  end if;

  next_current_seat_id := current_state.current_seat_id;
  if p_scalar_patch ? 'currentSeatId'
    or p_scalar_patch ? 'currentPlayerId' then
    requested_current_identity := nullif(
      coalesce(
        p_scalar_patch->>'currentSeatId',
        p_scalar_patch->>'currentPlayerId'
      ),
      ''
    );

    if requested_current_identity is null then
      next_current_seat_id := null;
    else
      begin
        next_current_seat_id := requested_current_identity::uuid;
      exception when invalid_text_representation then
        raise exception 'current_seat_id_invalid room=% seat=%',
          p_room_id,
          requested_current_identity
          using errcode = 'PT422';
      end;

      if not exists (
        select 1
        from public.room_players
        where room_id = p_room_id
          and id = next_current_seat_id
      ) then
        raise exception 'current_seat_not_in_room room=% seat=%',
          p_room_id,
          next_current_seat_id
          using errcode = 'PT422';
      end if;
    end if;
  end if;

  canonical_state_patch := meitra_private.canonicalize_state_identity_json(
    coalesce(p_state_patch, '{}'::jsonb)
  )
    - 'players'
    - 'playerOrder'
    - 'teamAssignments'
    - 'identitySchemaVersion';

  perform meitra_private.assert_state_identity_references(
    p_room_id,
    canonical_state_patch
  );

  if canonical_state_patch ? 'playerStates' then
    canonical_state_patch := jsonb_set(
      canonical_state_patch,
      '{playerStates}',
      meitra_private.canonicalize_player_states(
        p_room_id,
        canonical_state_patch->'playerStates'
      ),
      true
    );
  end if;

  update public.game_states
  set
    state_data = (coalesce(current_state.state_data, '{}'::jsonb)
      - 'players'
      - 'playerOrder'
      - 'teamAssignments')
      || canonical_state_patch
      || jsonb_build_object('identitySchemaVersion', 2),
    current_seat_id = next_current_seat_id,
    game_phase = case
      when p_scalar_patch ? 'gamePhase'
        then (p_scalar_patch->>'gamePhase')::game_phase
      else current_state.game_phase
    end,
    round_number = case
      when p_scalar_patch ? 'roundNumber'
        then (p_scalar_patch->>'roundNumber')::integer
      else current_state.round_number
    end,
    points_to_win = case
      when p_scalar_patch ? 'pointsToWin'
        then (p_scalar_patch->>'pointsToWin')::integer
      else current_state.points_to_win
    end,
    team_scores = case
      when p_scalar_patch ? 'teamScores'
        then p_scalar_patch->'teamScores'
      else current_state.team_scores
    end,
    team_score_records = case
      when p_scalar_patch ? 'teamScoreRecords'
        then p_scalar_patch->'teamScoreRecords'
      else current_state.team_score_records
    end,
    version = current_state.version + 1
  where room_id = p_room_id
  returning * into updated_state;

  return to_jsonb(updated_state);
end;
$function$;
  $sql$;
end;
$atomic_state_cleanup$;

create or replace function public.cancel_room_membership_reservation(
  p_user_id uuid,
  p_transition_id uuid
)
returns boolean
language plpgsql
set search_path to ''
as $function$
declare
  cancelled_membership public.active_room_memberships%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  delete from public.active_room_memberships
  where user_id = p_user_id
    and status = 'moving'
    and room_id is null
    and transition_id = p_transition_id
  returning * into cancelled_membership;

  if not found then
    return false;
  end if;

  insert into public.room_membership_events (
    transition_id,
    user_id,
    event_type,
    membership_version,
    metadata
  ) values (
    p_transition_id,
    p_user_id,
    'create_reservation_cancelled',
    cancelled_membership.membership_version,
    jsonb_build_object(
      'reservedSeatId',
      cancelled_membership.seat_id
    )
  );

  return true;
end;
$function$;

create or replace function public.release_room_membership(
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

  if not found then
    return jsonb_build_object('result', 'released');
  end if;

  if current_membership.room_id is distinct from p_room_id
    or current_membership.membership_version <> p_expected_version then
    return jsonb_build_object(
      'result', 'stale',
      'membership', to_jsonb(current_membership)
    );
  end if;

  delete from public.active_room_memberships
  where user_id = p_user_id;

  insert into public.room_membership_events (
    transition_id,
    user_id,
    from_room_id,
    seat_id,
    event_type,
    membership_version
  ) values (
    p_transition_id,
    p_user_id,
    p_room_id,
    current_membership.seat_id,
    'room_released',
    current_membership.membership_version
  );

  return jsonb_build_object('result', 'released');
end;
$function$;

create or replace function public.release_room_membership_by_player(
  p_room_id uuid,
  p_player_id text,
  p_transition_id uuid
)
returns boolean
language plpgsql
set search_path to ''
as $function$
declare
  requested_seat_id uuid;
  target_membership public.active_room_memberships%rowtype;
begin
  begin
    requested_seat_id := p_player_id::uuid;
  exception when invalid_text_representation then
    raise exception 'membership_seat_id_invalid seat=%', p_player_id
      using errcode = 'PT422';
  end;

  select *
  into target_membership
  from public.active_room_memberships
  where room_id = p_room_id
    and seat_id = requested_seat_id;

  if not found then
    return false;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_membership.user_id::text, 0)
  );

  delete from public.active_room_memberships
  where user_id = target_membership.user_id
    and room_id = p_room_id
    and seat_id = requested_seat_id;

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
    requested_seat_id,
    'player_membership_released',
    target_membership.membership_version
  );

  return true;
end;
$function$;

create or replace function public.release_room_memberships_for_room(
  p_room_id uuid,
  p_transition_id uuid
)
returns integer
language plpgsql
set search_path to ''
as $function$
declare
  released_count integer;
begin
  with deleted_memberships as (
    delete from public.active_room_memberships
    where room_id = p_room_id
    returning user_id, seat_id, membership_version
  ), inserted_events as (
    insert into public.room_membership_events (
      transition_id,
      user_id,
      from_room_id,
      seat_id,
      event_type,
      membership_version
    )
    select
      p_transition_id,
      user_id,
      p_room_id,
      seat_id,
      'room_closed',
      membership_version
    from deleted_memberships
    returning 1
  )
  select count(*) into released_count from inserted_events;

  return released_count;
end;
$function$;

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
    seat_id,
    event_type,
    membership_version
  ) values (
    p_transition_id,
    p_user_id,
    p_room_id,
    p_room_id,
    current_membership.seat_id,
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
    seat_id,
    event_type,
    membership_version
  ) values (
    p_transition_id,
    p_user_id,
    p_room_id,
    p_room_id,
    current_membership.seat_id,
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
      seat_id,
      event_type,
      membership_version
    ) values (
      p_transition_id,
      p_user_id,
      p_room_id,
      current_membership.seat_id,
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
    seat_id,
    event_type,
    membership_version
  ) values (
    p_transition_id,
    p_user_id,
    p_room_id,
    p_room_id,
    current_membership.seat_id,
    'disconnect_timeout_rolled_back',
    current_membership.membership_version
  );

  return jsonb_build_object(
    'result', 'rolled_back',
    'membership', to_jsonb(current_membership)
  );
end;
$function$;

create or replace function public.release_stale_room_membership(
  p_membership public.active_room_memberships,
  p_transition_id uuid
)
returns boolean
language plpgsql
set search_path to ''
as $function$
declare
  stale_room_status public.room_status;
begin
  if p_membership.room_id is null then
    return false;
  end if;

  select rooms.status
  into stale_room_status
  from public.rooms
  where rooms.id = p_membership.room_id;

  if found and stale_room_status not in ('finished', 'abandoned') then
    return false;
  end if;

  delete from public.active_room_memberships
  where user_id = p_membership.user_id
    and membership_version = p_membership.membership_version;

  if not found then
    return false;
  end if;

  insert into public.room_membership_events (
    transition_id,
    user_id,
    from_room_id,
    seat_id,
    event_type,
    membership_version,
    metadata
  ) values (
    p_transition_id,
    p_membership.user_id,
    p_membership.room_id,
    p_membership.seat_id,
    'stale_room_released',
    p_membership.membership_version,
    jsonb_build_object('roomStatus', stale_room_status)
  );

  return true;
end;
$function$;

create or replace function public.reserve_room_membership(
  p_user_id uuid,
  p_player_id text,
  p_transition_id uuid
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  requested_seat_id uuid;
  current_membership public.active_room_memberships%rowtype;
  has_membership boolean;
begin
  begin
    requested_seat_id := p_player_id::uuid;
  exception when invalid_text_representation then
    raise exception 'membership_seat_id_invalid seat=%', p_player_id
      using errcode = 'PT422';
  end;

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
      requested_seat_id,
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
      jsonb_build_object('reservedSeatId', requested_seat_id)
    );

    return jsonb_build_object(
      'result', 'reserved',
      'membership', to_jsonb(current_membership)
    );
  end if;

  if current_membership.status = 'moving'
    and current_membership.transition_id = p_transition_id
    and current_membership.seat_id = requested_seat_id then
    return jsonb_build_object(
      'result', 'reserved',
      'membership', to_jsonb(current_membership)
    );
  end if;

  if current_membership.status = 'moving'
    and current_membership.updated_at < now() - interval '2 minutes' then
    update public.active_room_memberships
    set
      seat_id = requested_seat_id,
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
        requested_seat_id
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
  p_player_id text,
  p_transition_id uuid
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  requested_seat_id uuid;
  current_membership public.active_room_memberships%rowtype;
  has_membership boolean;
  previous_room_id uuid;
  claim_result text;
begin
  begin
    requested_seat_id := p_player_id::uuid;
  exception when invalid_text_representation then
    raise exception 'membership_seat_id_invalid seat=%', p_player_id
      using errcode = 'PT422';
  end;

  if not exists (
    select 1
    from public.room_players
    where room_id = p_room_id
      and id = requested_seat_id
  ) then
    raise exception 'membership_seat_not_in_room room=% seat=%',
      p_room_id,
      requested_seat_id
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
      requested_seat_id,
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
    and current_membership.seat_id = requested_seat_id then
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
      seat_id = requested_seat_id,
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
      seat_id = requested_seat_id,
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
    requested_seat_id,
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

do $create_room_cleanup$
begin
  execute $sql$
create or replace function public.create_room_with_host_seat_atomic(
  p_room_id uuid,
  p_room_name text,
  p_host_seat_id uuid,
  p_host_user_id uuid,
  p_host_name text,
  p_room_settings jsonb,
  p_points_to_win integer,
  p_transition_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  current_membership public.active_room_memberships%rowtype;
  created_room public.rooms%rowtype;
  created_player public.room_players%rowtype;
  created_state public.game_states%rowtype;
begin
  if p_room_id is null
    or p_host_seat_id is null
    or p_host_user_id is null
    or p_transition_id is null then
    raise exception 'room_host_identity_required'
      using errcode = 'PT422';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('meitra-account-room-membership'),
    hashtext(p_host_user_id::text)
  );

  select *
  into current_membership
  from public.active_room_memberships
  where user_id = p_host_user_id
  for update;

  if not found
    or current_membership.status <> 'moving'
    or current_membership.room_id is not null
    or current_membership.seat_id <> p_host_seat_id
    or current_membership.transition_id <> p_transition_id then
    raise exception 'room_host_membership_reservation_required user=%',
      p_host_user_id
      using errcode = 'PT409';
  end if;

  insert into public.rooms (
    id,
    name,
    host_seat_id,
    status,
    settings,
    created_at,
    updated_at,
    last_activity_at
  ) values (
    p_room_id,
    p_room_name,
    p_host_seat_id,
    'waiting',
    p_room_settings,
    now(),
    now(),
    now()
  )
  returning * into created_room;

  insert into public.room_players (
    id,
    room_id,
    user_id,
    name,
    team,
    is_ready,
    is_com,
    joined_at,
    seat_index
  ) values (
    p_host_seat_id,
    p_room_id,
    p_host_user_id,
    p_host_name,
    0,
    false,
    false,
    now(),
    0
  )
  returning * into created_player;

  insert into public.game_states (
    room_id,
    state_data,
    current_seat_id,
    game_phase,
    round_number,
    points_to_win
  ) values (
    p_room_id,
    jsonb_build_object(
      'identitySchemaVersion', 2,
      'playerStates', jsonb_build_object(
        p_host_seat_id::text,
        jsonb_build_object(
          'hand', '[]'::jsonb,
          'isPasser', false,
          'hasBroken', false,
          'hasRequiredBroken', false
        )
      ),
      'deck', '[]'::jsonb,
      'blowState', jsonb_build_object(
        'currentTrump', null,
        'currentHighestDeclaration', null,
        'declarations', '[]'::jsonb,
        'actionHistory', '[]'::jsonb,
        'lastPasserSeatId', null,
        'isRoundCancelled', false,
        'currentBlowIndex', 0
      ),
      'playState', jsonb_build_object(
        'currentField', null,
        'negriCard', null,
        'negriSeatId', null,
        'neguri', '{}'::jsonb,
        'fields', '[]'::jsonb,
        'lastWinnerSeatId', null,
        'openDeclared', false,
        'openDeclarerSeatId', null
      )
    ),
    null,
    null,
    1,
    p_points_to_win
  )
  returning * into created_state;

  update public.active_room_memberships
  set
    room_id = p_room_id,
    status = 'active',
    membership_version = membership_version + 1,
    last_seen_at = now()
  where user_id = p_host_user_id
    and transition_id = p_transition_id;

  insert into public.room_membership_events (
    transition_id,
    user_id,
    to_room_id,
    seat_id,
    event_type,
    membership_version
  ) values (
    p_transition_id,
    p_host_user_id,
    p_room_id,
    p_host_seat_id,
    'room_created_and_claimed',
    current_membership.membership_version + 1
  );

  return jsonb_build_object(
    'room', to_jsonb(created_room),
    'roomPlayer', to_jsonb(created_player),
    'gameState', to_jsonb(created_state)
  );
end;
$function$;
  $sql$;
end;
$create_room_cleanup$;

update public.game_history
set actor_key_snapshot = null
where actor_seat_id is not null
  and actor_key_snapshot = actor_seat_id::text;

alter table public.active_room_memberships
  alter column seat_id set not null;

drop function if exists public.sync_active_room_membership_seat();
drop function if exists public.sync_room_membership_event_seat();
drop function if exists public.sync_game_history_actor_seat();
drop function if exists public.sync_game_state_current_seat_identity();
drop function if exists public.sync_room_host_seat_identity();
drop function if exists meitra_private.keep_anonymized_host_on_seat_id();
drop function if exists meitra_private.resolve_room_seat_id(uuid, text, uuid);

alter table public.rooms
  drop column host_id;

alter table public.game_states
  drop column current_player_id;

alter table public.game_history
  drop column player_id;

alter table public.active_room_memberships
  drop column player_id;

alter table public.room_players
  drop column player_id,
  drop column socket_id,
  drop column is_host;

create trigger reject_deleting_room_host
before insert or update of host_seat_id on public.rooms
for each row execute function public.reject_deleting_room_host();

comment on column public.room_players.id is
  'Canonical immutable seat UUID within a room.';
comment on column public.rooms.host_seat_id is
  'Canonical host seat UUID. Runtime hostId is an alias of this value.';
comment on column public.game_states.current_seat_id is
  'Canonical current-turn seat UUID.';
comment on column public.game_history.actor_seat_id is
  'Canonical actor seat UUID. actor_key_snapshot is reserved for unresolved legacy actors.';

select pg_notify('pgrst', 'reload schema');
