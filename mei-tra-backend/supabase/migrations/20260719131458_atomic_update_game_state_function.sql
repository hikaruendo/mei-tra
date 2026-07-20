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

  update public.game_states
  set
    state_data = coalesce(current_state.state_data, '{}'::jsonb)
      || coalesce(p_state_patch, '{}'::jsonb),
    current_player_index = case
      when p_scalar_patch ? 'currentPlayerIndex'
        then (p_scalar_patch->>'currentPlayerIndex')::integer
      else current_state.current_player_index
    end,
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
    team_assignments = case
      when p_scalar_patch ? 'teamAssignments'
        then p_scalar_patch->'teamAssignments'
      else current_state.team_assignments
    end,
    version = current_state.version + 1
  where room_id = p_room_id
  returning * into updated_state;

  return to_jsonb(updated_state);
end;
$$;
