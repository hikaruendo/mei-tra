create or replace function public.persist_room_roster_atomic(
  p_room_id uuid,
  p_room_players jsonb,
  p_player_states jsonb,
  p_player_order jsonb,
  p_legacy_players jsonb,
  p_team_assignments jsonb,
  p_host_id text default null,
  p_expected_version bigint default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_state public.game_states%rowtype;
  updated_state public.game_states%rowtype;
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
    hand,
    team,
    is_passer,
    has_broken,
    has_required_broken,
    is_ready,
    is_host,
    is_com,
    joined_at
  )
  select
    p_room_id,
    player."playerId",
    null,
    nullif(player."userId", '')::uuid,
    player.name,
    coalesce(p_player_states->player."playerId"->'hand', '[]'::jsonb),
    player.team,
    coalesce(
      (p_player_states->player."playerId"->>'isPasser')::boolean,
      false
    ),
    coalesce(
      (p_player_states->player."playerId"->>'hasBroken')::boolean,
      false
    ),
    coalesce(
      (p_player_states->player."playerId"->>'hasRequiredBroken')::boolean,
      false
    ),
    coalesce(player."isReady", false),
    coalesce(player."isHost", false),
    coalesce(player."isCOM", false),
    coalesce(player."joinedAt", now())
  from jsonb_to_recordset(coalesce(p_room_players, '[]'::jsonb)) as player(
    "playerId" text,
    "userId" text,
    name text,
    team integer,
    "isReady" boolean,
    "isHost" boolean,
    "isCOM" boolean,
    "joinedAt" timestamptz
  )
  on conflict (room_id, player_id) do update
  set
    socket_id = null,
    user_id = excluded.user_id,
    name = excluded.name,
    hand = excluded.hand,
    team = excluded.team,
    is_passer = excluded.is_passer,
    has_broken = excluded.has_broken,
    has_required_broken = excluded.has_required_broken,
    is_ready = excluded.is_ready,
    is_host = excluded.is_host,
    is_com = excluded.is_com,
    joined_at = excluded.joined_at;

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
    state_data = coalesce(current_state.state_data, '{}'::jsonb)
      || jsonb_build_object(
        'playerStates', coalesce(p_player_states, '{}'::jsonb),
        'playerOrder', coalesce(p_player_order, '[]'::jsonb),
        'players', coalesce(p_legacy_players, '[]'::jsonb)
      ),
    team_assignments = coalesce(p_team_assignments, '{}'::jsonb),
    version = current_state.version + 1
  where room_id = p_room_id
  returning * into updated_state;

  return to_jsonb(updated_state);
end;
$$;
