do $migration$
begin
  execute $sql$
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
      )
        or exists (
          select 1
          from public.rooms as room
          where room.host_id = p_user_id::text
            and room.status in ('waiting', 'ready', 'playing')
        )
      then
        raise exception 'account_deletion_blocked user=%', p_user_id
          using errcode = 'PT409';
      end if;

      update public.user_profiles
      set account_deletion_started_at =
        coalesce(account_deletion_started_at, now())
      where id = p_user_id
      returning * into profile;

      if not found then
        return null;
      end if;

      return to_jsonb(profile);
    end;
    $function$
  $sql$;

  execute $sql$
    create or replace function public.reject_deleting_room_player_user()
    returns trigger
    language plpgsql
    security invoker
    set search_path = public
    as $function$
    begin
      if new.user_id is null then
        return new;
      end if;

      perform pg_advisory_xact_lock(
        hashtext('meitra-account-room-membership'),
        hashtext(new.user_id::text)
      );

      if exists (
        select 1
        from public.user_profiles
        where id = new.user_id
          and account_deletion_started_at is not null
      ) then
        raise exception 'account_deletion_in_progress user=%', new.user_id
          using errcode = 'PT403';
      end if;

      return new;
    end;
    $function$
  $sql$;

  execute $sql$
    create or replace function public.reject_deleting_room_host()
    returns trigger
    language plpgsql
    security invoker
    set search_path = public
    as $function$
    declare
      host_user_id uuid;
    begin
      if new.host_id is null then
        return new;
      end if;

      if new.host_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        host_user_id := new.host_id::uuid;

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
          raise exception 'account_deletion_in_progress host=%', new.host_id
            using errcode = 'PT403';
        end if;
      end if;

      return new;
    end;
    $function$
  $sql$;

  execute $sql$
    create or replace function public.persist_room_roster_atomic(
      p_room_id uuid,
      p_room_players jsonb,
      p_player_states jsonb,
      p_player_order jsonb,
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
      lock_user_id uuid;
    begin
      for lock_user_id in
        select distinct candidate.user_id
        from (
          select case
            when player."userId" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then player."userId"::uuid
            else null
          end as user_id
          from jsonb_to_recordset(coalesce(p_room_players, '[]'::jsonb)) as player(
            "userId" text
          )

          union all

          select case
            when p_host_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then p_host_id::uuid
            else null
          end
        ) as candidate
        where candidate.user_id is not null
        order by candidate.user_id
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

      update public.game_states
      set
        state_data = (coalesce(current_state.state_data, '{}'::jsonb) - 'players')
          || jsonb_build_object(
            'playerStates', coalesce(p_player_states, '{}'::jsonb),
            'playerOrder', coalesce(p_player_order, '[]'::jsonb)
          ),
        version = current_state.version + 1
      where room_id = p_room_id
      returning * into updated_state;

      return to_jsonb(updated_state);
    end;
    $function$
  $sql$;

  execute $sql$
    revoke all on function public.mark_account_deletion_started(uuid)
      from public, anon, authenticated
  $sql$;

  execute $sql$
    grant execute on function public.mark_account_deletion_started(uuid)
      to service_role
  $sql$;

  execute $sql$
    revoke all on function public.persist_room_roster_atomic(
      uuid,
      jsonb,
      jsonb,
      jsonb,
      text,
      bigint
    ) from public, anon, authenticated
  $sql$;

  execute $sql$
    grant execute on function public.persist_room_roster_atomic(
      uuid,
      jsonb,
      jsonb,
      jsonb,
      text,
      bigint
    ) to service_role
  $sql$;

  execute $sql$
    select pg_notify('pgrst', 'reload schema')
  $sql$;
end;
$migration$;
