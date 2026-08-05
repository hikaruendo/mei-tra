do $migration$
begin
  alter table public.game_states
    add column if not exists current_player_id text;

  update public.game_states as game_state
  set current_player_id = coalesce(
    (
      select room_player.player_id
      from public.room_players as room_player
      where room_player.room_id = game_state.room_id
        and room_player.player_id = game_state.current_player_id
      limit 1
    ),
    (
      select room_player.player_id
      from public.room_players as room_player
      where room_player.room_id = game_state.room_id
        and room_player.player_id =
          game_state.state_data->'playerOrder'->>greatest(
            coalesce(game_state.current_player_index, 0),
            0
          )
      limit 1
    ),
    (
      select ordered_players.player_id
      from (
        select
          room_player.player_id,
          row_number() over (order by room_player.seat_index asc) - 1 as zero_based_index
        from public.room_players as room_player
        where room_player.room_id = game_state.room_id
      ) as ordered_players
      where ordered_players.zero_based_index =
        greatest(coalesce(game_state.current_player_index, 0), 0)
      limit 1
    )
  );

  update public.game_states
  set state_data = coalesce(state_data, '{}'::jsonb) - 'players' - 'playerOrder';

  drop function if exists public.persist_room_roster_atomic(
    uuid,
    jsonb,
    jsonb,
    jsonb,
    text,
    bigint
  );
  drop function if exists public.persist_room_roster_atomic(
    uuid,
    jsonb,
    jsonb,
    text,
    bigint
  );

  execute $sql$
    create function public.persist_room_roster_atomic(
      p_room_id uuid,
      p_room_players jsonb,
      p_player_states jsonb,
      p_host_id text default null,
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
      current_seat_index integer;
      next_current_player_id text;
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

      if current_state.current_player_id is not null then
        select room_player.seat_index
        into current_seat_index
        from public.room_players as room_player
        where room_player.room_id = p_room_id
          and room_player.player_id = current_state.current_player_id;
      end if;

      delete from public.room_players as room_player
      where room_player.room_id = p_room_id
        and not exists (
          select 1
          from jsonb_array_elements(coalesce(p_room_players, '[]'::jsonb)) as entry
          where entry->>'playerId' = room_player.player_id
        );

      insert into public.room_players (
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
      )
      select
        p_room_id,
        player."playerId",
        null,
        nullif(player."userId", '')::uuid,
        player.name,
        player.team,
        coalesce(player."isReady", false),
        coalesce(player."isHost", false),
        coalesce(player."isCOM", false),
        coalesce(player."joinedAt", now()),
        player."seatIndex"
      from jsonb_to_recordset(coalesce(p_room_players, '[]'::jsonb)) as player(
        "playerId" text,
        "userId" text,
        name text,
        team integer,
        "isReady" boolean,
        "isHost" boolean,
        "isCOM" boolean,
        "joinedAt" timestamptz,
        "seatIndex" integer
      )
      on conflict (room_id, player_id) do update
      set
        socket_id = null,
        user_id = excluded.user_id,
        name = excluded.name,
        team = excluded.team,
        is_ready = excluded.is_ready,
        is_host = excluded.is_host,
        is_com = excluded.is_com,
        joined_at = excluded.joined_at,
        seat_index = excluded.seat_index;

      if p_host_id is not null then
        update public.rooms
        set
          host_id = p_host_id,
          last_activity_at = now()
        where id = p_room_id;
      else
        update public.rooms
        set last_activity_at = now()
        where id = p_room_id;
      end if;

      next_current_player_id := current_state.current_player_id;

      if next_current_player_id is not null
        and not exists (
          select 1
          from public.room_players as room_player
          where room_player.room_id = p_room_id
            and room_player.player_id = next_current_player_id
        ) then
        select room_player.player_id
        into next_current_player_id
        from public.room_players as room_player
        where room_player.room_id = p_room_id
          and room_player.seat_index = current_seat_index
        limit 1;
      end if;

      update public.game_states
      set
        state_data = (coalesce(current_state.state_data, '{}'::jsonb) - 'players' - 'playerOrder')
          || jsonb_build_object(
            'playerStates', coalesce(p_player_states, '{}'::jsonb)
          ),
        current_player_id = next_current_player_id,
        version = current_state.version + 1
      where room_id = p_room_id
      returning * into updated_state;

      return to_jsonb(updated_state);
    end;
    $function$
  $sql$;

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
      next_current_player_id text;
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

      next_current_player_id := current_state.current_player_id;
      if p_scalar_patch ? 'currentPlayerId' then
        next_current_player_id := nullif(
          p_scalar_patch->>'currentPlayerId',
          ''
        );
      end if;

      if next_current_player_id is not null
        and not exists (
          select 1
          from public.room_players as room_player
          where room_player.room_id = p_room_id
            and room_player.player_id = next_current_player_id
        ) then
        raise exception 'current_player_not_in_room room=% player=%',
          p_room_id,
          next_current_player_id
          using errcode = 'PT422';
      end if;

      update public.game_states
      set
        state_data = (coalesce(current_state.state_data, '{}'::jsonb) - 'players' - 'playerOrder')
          || (coalesce(p_state_patch, '{}'::jsonb) - 'players' - 'playerOrder'),
        current_player_id = next_current_player_id,
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

  alter table public.game_states
    drop column if exists current_player_index;

  revoke all on function public.persist_room_roster_atomic(
    uuid,
    jsonb,
    jsonb,
    text,
    bigint
  ) from public, anon, authenticated;
  grant execute on function public.persist_room_roster_atomic(
    uuid,
    jsonb,
    jsonb,
    text,
    bigint
  ) to service_role;
  revoke all on function public.atomic_update_game_state(
    uuid,
    jsonb,
    jsonb,
    bigint
  ) from public, anon, authenticated;
  grant execute on function public.atomic_update_game_state(
    uuid,
    jsonb,
    jsonb,
    bigint
  ) to service_role;
  perform pg_notify('pgrst', 'reload schema');
end;
$migration$;
