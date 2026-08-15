-- Refresh the atomic roster writer after membership identity moved to seat UUIDs.
-- The removed text overloads must not be restored; callers use the UUID functions directly.

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
    requested_seat_identity := nullif(player_entry->>'seatId', '');

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
          requested_seat_id,
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
    perform public.release_room_membership_by_seat(
      p_room_id,
      (p_membership_mutation->>'seatId')::uuid,
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
  if p_scalar_patch ? 'currentSeatId' then
    requested_current_identity := nullif(
      p_scalar_patch->>'currentSeatId',
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

  canonical_state_patch := coalesce(p_state_patch, '{}'::jsonb)
    - 'playerStates'
    - 'identitySchemaVersion';

  perform meitra_private.assert_state_identity_references(
    p_room_id,
    canonical_state_patch
  );

  update public.game_states
  set
    state_data = coalesce(current_state.state_data, '{}'::jsonb)
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
