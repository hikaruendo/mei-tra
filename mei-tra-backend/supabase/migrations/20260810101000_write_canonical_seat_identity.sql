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
  resolved_seat_id uuid;
  canonical_states jsonb := '{}'::jsonb;
begin
  for state_entry in
    select key, value
    from jsonb_each(coalesce(p_player_states, '{}'::jsonb))
  loop
    resolved_seat_id := meitra_private.resolve_room_seat_id(
      p_room_id,
      state_entry.key,
      null
    );

    if resolved_seat_id is null then
      raise exception 'player_state_seat_not_in_room room=% identity=%',
        p_room_id,
        state_entry.key
        using errcode = 'PT422';
    end if;

    canonical_states := canonical_states || jsonb_build_object(
      resolved_seat_id::text,
      state_entry.value
    );
  end loop;

  return canonical_states;
end;
$function$;

revoke all on function meitra_private.canonicalize_player_states(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function meitra_private.canonicalize_player_states(uuid, jsonb)
  to service_role;

create or replace function public.sync_active_room_membership_seat()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
begin
  if new.room_id is null then
    new.seat_id := null;
    return new;
  end if;

  new.seat_id := coalesce(
    new.seat_id,
    meitra_private.resolve_room_seat_id(
      new.room_id,
      new.player_id,
      new.user_id
    )
  );

  if new.seat_id is null then
    raise exception 'active_membership_seat_not_in_room room=% user=% identity=%',
      new.room_id,
      new.user_id,
      new.player_id
      using errcode = 'PT422';
  end if;

  new.player_id := new.seat_id::text;
  return new;
end;
$function$;

drop trigger if exists sync_active_room_membership_seat
  on public.active_room_memberships;

create trigger sync_active_room_membership_seat
before insert or update of room_id, player_id, user_id, seat_id
on public.active_room_memberships
for each row execute function public.sync_active_room_membership_seat();

create or replace function public.sync_room_membership_event_seat()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  event_room_id uuid;
begin
  if new.seat_id is not null then
    return new;
  end if;

  event_room_id := coalesce(new.to_room_id, new.from_room_id);
  if event_room_id is null then
    return new;
  end if;

  select membership.seat_id
  into new.seat_id
  from public.active_room_memberships as membership
  where membership.user_id = new.user_id
    and membership.room_id = event_room_id;

  if new.seat_id is null then
    new.seat_id := meitra_private.resolve_room_seat_id(
      event_room_id,
      null,
      new.user_id
    );
  end if;

  return new;
end;
$function$;

drop trigger if exists sync_room_membership_event_seat
  on public.room_membership_events;

create trigger sync_room_membership_event_seat
before insert on public.room_membership_events
for each row execute function public.sync_room_membership_event_seat();

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

comment on column public.room_players.user_id is
  'Authenticated seat owner. A timeout-controlled COM keeps this value so the same user can reclaim the seat after a process restart.';

create or replace function public.sync_game_history_actor_seat()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
begin
  new.actor_key_snapshot := coalesce(
    new.actor_key_snapshot,
    new.player_id
  );

  if new.actor_seat_id is null and new.player_id is not null then
    new.actor_seat_id := meitra_private.resolve_room_seat_id(
      new.room_id,
      new.player_id,
      null
    );
  end if;

  if new.actor_seat_id is not null then
    new.player_id := new.actor_seat_id::text;
  end if;

  return new;
end;
$function$;

drop trigger if exists sync_game_history_actor_seat
  on public.game_history;

create trigger sync_game_history_actor_seat
before insert or update of room_id, player_id, actor_seat_id
on public.game_history
for each row execute function public.sync_game_history_actor_seat();

create or replace function public.sync_room_host_seat_identity()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  resolved_seat_id uuid;
begin
  if new.host_seat_id is null and new.host_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' and new.host_seat_id is not null then
    new.host_id := new.host_seat_id::text;
    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.host_seat_id is distinct from old.host_seat_id then
    new.host_id := new.host_seat_id::text;
    return new;
  end if;

  if new.host_id is not null then
    resolved_seat_id := meitra_private.resolve_room_seat_id(
      new.id,
      new.host_id,
      null
    );
  end if;

  if resolved_seat_id is not null then
    new.host_seat_id := resolved_seat_id;
    new.host_id := resolved_seat_id::text;
    return new;
  end if;

  if new.host_seat_id is not null and new.host_id is null then
    new.host_id := new.host_seat_id::text;
    return new;
  end if;

  return new;
end;
$function$;

drop trigger if exists sync_room_host_seat_identity on public.rooms;

create trigger sync_room_host_seat_identity
before insert or update of host_id, host_seat_id on public.rooms
for each row execute function public.sync_room_host_seat_identity();

create or replace function public.sync_game_state_current_seat_identity()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  resolved_seat_id uuid;
  legacy_identity_changed boolean;
  canonical_identity_changed boolean;
begin
  if tg_op = 'INSERT' then
    if new.current_seat_id is not null then
      new.current_player_id := new.current_seat_id::text;
      return new;
    end if;
    legacy_identity_changed := new.current_player_id is not null;
    canonical_identity_changed := false;
  else
    legacy_identity_changed :=
      new.current_player_id is distinct from old.current_player_id;
    canonical_identity_changed :=
      new.current_seat_id is distinct from old.current_seat_id;
  end if;

  if canonical_identity_changed then
    new.current_player_id := new.current_seat_id::text;
    return new;
  end if;

  if legacy_identity_changed then
    if new.current_player_id is null then
      new.current_seat_id := null;
      return new;
    end if;

    resolved_seat_id := meitra_private.resolve_room_seat_id(
      new.room_id,
      new.current_player_id,
      null
    );
    if resolved_seat_id is null then
      raise exception 'current_seat_not_in_room room=% identity=%',
        new.room_id,
        new.current_player_id
        using errcode = 'PT422';
    end if;
    new.current_seat_id := resolved_seat_id;
    new.current_player_id := resolved_seat_id::text;
    return new;
  end if;

  if new.current_seat_id is null then
    new.current_player_id := null;
  else
    new.current_player_id := new.current_seat_id::text;
  end if;
  return new;
end;
$function$;

drop trigger if exists sync_game_state_current_seat_identity
  on public.game_states;

create trigger sync_game_state_current_seat_identity
before insert or update of current_player_id, current_seat_id
on public.game_states
for each row execute function public.sync_game_state_current_seat_identity();

create or replace function meitra_private.keep_anonymized_host_on_seat_id()
returns trigger
language plpgsql
security invoker
set search_path = meitra_private
as $function$
begin
  if new.was_host then
    new.anonymized_player_id := new.room_player_id::text;
  end if;
  return new;
end;
$function$;

drop trigger if exists keep_anonymized_host_on_seat_id
  on meitra_private.account_anonymization_player_map;

create trigger keep_anonymized_host_on_seat_id
before insert or update of room_player_id, anonymized_player_id, was_host
on meitra_private.account_anonymization_player_map
for each row execute function meitra_private.keep_anonymized_host_on_seat_id();

update meitra_private.account_anonymization_player_map
set anonymized_player_id = room_player_id::text
where was_host
  and anonymized_player_id is distinct from room_player_id::text;

do $create_room_migration$
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
    or current_membership.transition_id <> p_transition_id then
    raise exception 'room_host_membership_reservation_required user=%',
      p_host_user_id
      using errcode = 'PT409';
  end if;

  insert into public.rooms (
    id,
    name,
    host_id,
    host_seat_id,
    status,
    settings,
    created_at,
    updated_at,
    last_activity_at
  ) values (
    p_room_id,
    p_room_name,
    p_host_seat_id::text,
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
    player_id,
    socket_id,
    user_id,
    name,
    team,
    is_ready,
    is_host,
    is_com,
    joined_at,
    seat_index
  ) values (
    p_host_seat_id,
    p_room_id,
    p_host_user_id::text,
    null,
    p_host_user_id,
    p_host_name,
    0,
    false,
    true,
    false,
    now(),
    0
  )
  returning * into created_player;

  insert into public.game_states (
    room_id,
    state_data,
    current_player_id,
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
        'lastPasser', null,
        'isRoundCancelled', false,
        'currentBlowIndex', 0
      ),
      'playState', jsonb_build_object(
        'currentField', null,
        'negriCard', null,
        'negriSeatId', null,
        'negriPlayerId', null,
        'neguri', '{}'::jsonb,
        'fields', '[]'::jsonb,
        'lastWinnerSeatId', null,
        'lastWinnerId', null,
        'openDeclared', false,
        'openDeclarerSeatId', null,
        'openDeclarerId', null
      )
    ),
    null,
    null,
    null,
    1,
    p_points_to_win
  )
  returning * into created_state;

  update public.active_room_memberships
  set
    room_id = p_room_id,
    player_id = p_host_seat_id::text,
    seat_id = p_host_seat_id,
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
$function$
  $sql$;
end;
$create_room_migration$;

do $create_room_permissions$
begin
  execute $sql$
    revoke all on function public.create_room_with_host_seat_atomic(
      uuid,
      text,
      uuid,
      uuid,
      text,
      jsonb,
      integer,
      uuid
    ) from public, anon, authenticated
  $sql$;
  execute $sql$
    grant execute on function public.create_room_with_host_seat_atomic(
      uuid,
      text,
      uuid,
      uuid,
      text,
      jsonb,
      integer,
      uuid
    ) to service_role
  $sql$;
end;
$create_room_permissions$;

do $persist_roster_migration$
begin
  execute $drop$
    drop function if exists public.persist_room_roster_atomic(
      uuid,
      jsonb,
      jsonb,
      text,
      bigint
    )
  $drop$;

  execute $drop$
    drop function if exists public.persist_room_roster_atomic(
      uuid,
      jsonb,
      jsonb,
      jsonb,
      text,
      bigint
    )
  $drop$;

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
  state_entry record;
  requested_seat_id uuid;
  resolved_seat_id uuid;
  resolved_room_id uuid;
  resolved_seat_index integer;
  incoming_seat_ids uuid[] := array[]::uuid[];
  incoming_seat_indexes integer[] := array[]::integer[];
  player_seat_index integer;
  participant_key text;
  player_user_id uuid;
  canonical_player_states jsonb := '{}'::jsonb;
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
    requested_seat_id := null;
    resolved_seat_id := null;
    resolved_room_id := null;
    resolved_seat_index := null;

    if nullif(player_entry->>'seatId', '') is not null then
      begin
        requested_seat_id := (player_entry->>'seatId')::uuid;
      exception when invalid_text_representation then
        raise exception 'invalid_roster_seat_id room=% seat=%',
          p_room_id,
          player_entry->>'seatId'
          using errcode = 'PT422';
      end;

      select room_id, seat_index
      into resolved_room_id, resolved_seat_index
      from public.room_players
      where id = requested_seat_id
      for update;

      if found then
        if resolved_room_id <> p_room_id then
          raise exception 'roster_seat_belongs_to_other_room room=% seat=%',
            p_room_id,
            requested_seat_id
            using errcode = 'PT422';
        end if;
        if resolved_seat_index <> player_seat_index then
          raise exception 'roster_seat_index_is_immutable room=% seat=% expected=% actual=%',
            p_room_id,
            requested_seat_id,
            resolved_seat_index,
            player_seat_index
            using errcode = 'PT422';
        end if;
        resolved_seat_id := requested_seat_id;
      elsif exists (
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
      else
        resolved_seat_id := requested_seat_id;
      end if;
    else
      select id
      into resolved_seat_id
      from public.room_players
      where room_id = p_room_id
        and seat_index = player_seat_index
      for update;

      if not found then
        resolved_seat_id := uuid_generate_v4();
      end if;
    end if;

    if resolved_seat_id = any(incoming_seat_ids) then
      raise exception 'duplicate_roster_seat_id room=% seat=%',
        p_room_id,
        resolved_seat_id
        using errcode = 'PT422';
    end if;

    participant_key := coalesce(
      nullif(player_entry->>'participantKey', ''),
      nullif(player_entry->>'legacyPlayerId', ''),
      nullif(player_entry->>'playerId', ''),
      resolved_seat_id::text
    );
    player_user_id := nullif(player_entry->>'userId', '')::uuid;

    insert into public.room_players (
      id,
      room_id,
      player_id,
      socket_id,
      user_id,
      name,
      team,
      is_ready,
      is_host,
      is_com,
      joined_at,
      seat_index
    ) values (
      resolved_seat_id,
      p_room_id,
      participant_key,
      null,
      player_user_id,
      player_entry->>'name',
      (player_entry->>'team')::integer,
      coalesce((player_entry->>'isReady')::boolean, false),
      false,
      coalesce((player_entry->>'isCOM')::boolean, false),
      coalesce((player_entry->>'joinedAt')::timestamptz, now()),
      player_seat_index
    )
    on conflict (id) do update
    set
      player_id = excluded.player_id,
      socket_id = null,
      user_id = excluded.user_id,
      name = excluded.name,
      team = excluded.team,
      is_ready = excluded.is_ready,
      is_com = excluded.is_com,
      joined_at = excluded.joined_at
    where room_players.room_id = excluded.room_id
      and room_players.seat_index = excluded.seat_index;

    get diagnostics upserted_count = row_count;
    if upserted_count <> 1 then
      raise exception 'roster_seat_upsert_rejected room=% seat=% index=%',
        p_room_id,
        resolved_seat_id,
        player_seat_index
        using errcode = 'PT409';
    end if;

    incoming_seat_ids := array_append(incoming_seat_ids, resolved_seat_id);
    incoming_seat_indexes := array_append(
      incoming_seat_indexes,
      player_seat_index
    );

    if player_user_id is not null then
      if mutation_type = 'claim'
        and p_membership_mutation->>'userId' = player_user_id::text then
        mutation_result := public.claim_room_membership(
          player_user_id,
          p_room_id,
          resolved_seat_id::text,
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
      set
        seat_id = resolved_seat_id,
        player_id = resolved_seat_id::text
      where user_id = player_user_id
        and room_id = p_room_id;

      update public.room_membership_events
      set seat_id = resolved_seat_id
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

  next_host_seat_id := case
    when p_host_id is null then (
      select host_seat_id from public.rooms where id = p_room_id
    )
    else meitra_private.resolve_room_seat_id(p_room_id, p_host_id, null)
  end;

  if p_host_id is not null and next_host_seat_id is null then
    raise exception 'host_seat_not_in_room room=% identity=%',
      p_room_id,
      p_host_id
      using errcode = 'PT422';
  end if;

  update public.room_players
  set is_host = id = next_host_seat_id
  where room_id = p_room_id;

  update public.rooms
  set
    host_seat_id = next_host_seat_id,
    host_id = coalesce(next_host_seat_id::text, host_id),
    last_activity_at = now()
  where id = p_room_id;

  for state_entry in
    select key, value
    from jsonb_each(coalesce(p_player_states, '{}'::jsonb))
  loop
    resolved_seat_id := meitra_private.resolve_room_seat_id(
      p_room_id,
      state_entry.key,
      null
    );
    if resolved_seat_id is null then
      raise exception 'player_state_seat_not_in_room room=% identity=%',
        p_room_id,
        state_entry.key
        using errcode = 'PT422';
    end if;
    canonical_player_states := canonical_player_states || jsonb_build_object(
      resolved_seat_id::text,
      state_entry.value
    );
  end loop;

  next_current_seat_id := coalesce(
    current_state.current_seat_id,
    meitra_private.resolve_room_seat_id(
      p_room_id,
      current_state.current_player_id,
      null
    )
  );

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
      next_current_seat_id := meitra_private.resolve_room_seat_id(
        p_room_id,
        requested_current_identity,
        null
      );
      if next_current_seat_id is null then
        raise exception 'current_seat_not_in_room room=% identity=%',
          p_room_id,
          requested_current_identity
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

  canonical_state_patch := coalesce(p_state_patch, '{}'::jsonb)
    - 'players'
    - 'playerOrder'
    - 'playerStates'
    - 'identitySchemaVersion';

  update public.game_states
  set
    state_data = (coalesce(current_state.state_data, '{}'::jsonb)
      - 'players'
      - 'playerOrder')
      || canonical_state_patch
      || jsonb_build_object(
        'identitySchemaVersion', 2,
        'playerStates', canonical_player_states
      ),
    current_seat_id = next_current_seat_id,
    current_player_id = next_current_seat_id::text,
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
$function$
  $sql$;
end;
$persist_roster_migration$;

do $atomic_state_migration$
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

  next_current_seat_id := coalesce(
    current_state.current_seat_id,
    meitra_private.resolve_room_seat_id(
      p_room_id,
      current_state.current_player_id,
      null
    )
  );

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
      next_current_seat_id := meitra_private.resolve_room_seat_id(
        p_room_id,
        requested_current_identity,
        null
      );
      if next_current_seat_id is null then
        raise exception 'current_seat_not_in_room room=% identity=%',
          p_room_id,
          requested_current_identity
          using errcode = 'PT422';
      end if;
    end if;
  end if;

  canonical_state_patch := coalesce(p_state_patch, '{}'::jsonb)
    - 'players'
    - 'playerOrder'
    - 'identitySchemaVersion';

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
      - 'playerOrder')
      || canonical_state_patch
      || jsonb_build_object('identitySchemaVersion', 2),
    current_seat_id = next_current_seat_id,
    current_player_id = next_current_seat_id::text,
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
$function$
  $sql$;
end;
$atomic_state_migration$;

do $release_membership_migration$
begin
  execute $sql$
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
  target_membership public.active_room_memberships%rowtype;
begin
  select *
  into target_membership
  from public.active_room_memberships
  where room_id = p_room_id
    and (
      seat_id::text = p_player_id
      or player_id = p_player_id
    );

  if not found then
    return false;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_membership.user_id::text, 0)
  );

  delete from public.active_room_memberships
  where user_id = target_membership.user_id
    and room_id = p_room_id
    and seat_id = target_membership.seat_id;

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
    target_membership.seat_id,
    'player_membership_released',
    target_membership.membership_version
  );

  return true;
end;
$function$
  $sql$;
end;
$release_membership_migration$;

do $seat_identity_permissions$
begin
  execute $sql$
    revoke all on function public.persist_room_roster_atomic(
      uuid,
      jsonb,
      jsonb,
      text,
      bigint,
      jsonb,
      jsonb,
      jsonb
    ) from public, anon, authenticated
  $sql$;
  execute $sql$
    revoke all on function public.atomic_update_game_state(
      uuid,
      jsonb,
      jsonb,
      bigint
    ) from public, anon, authenticated
  $sql$;
  execute $sql$
    revoke all on function public.release_room_membership_by_player(
      uuid,
      text,
      uuid
    ) from public, anon, authenticated
  $sql$;
  execute $sql$
    grant execute on function public.persist_room_roster_atomic(
      uuid,
      jsonb,
      jsonb,
      text,
      bigint,
      jsonb,
      jsonb,
      jsonb
    ) to service_role
  $sql$;
  execute $sql$
    grant execute on function public.atomic_update_game_state(
      uuid,
      jsonb,
      jsonb,
      bigint
    ) to service_role
  $sql$;
  execute $sql$
    grant execute on function public.release_room_membership_by_player(
      uuid,
      text,
      uuid
    ) to service_role
  $sql$;
  perform pg_notify('pgrst', 'reload schema');
end;
$seat_identity_permissions$;
