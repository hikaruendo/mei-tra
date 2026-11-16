-- Ranked records outlive rooms and game history. A ranked match is a game that
-- four people start; the match ID comes from the game state at game start, so
-- a rematch in the same room is a different match.
create table public.ranked_matches (
  match_id uuid primary key,
  mode text not null check (mode in ('normal', 'pro')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  winning_team smallint check (winning_team in (0, 1)),
  -- A match that has not finished has no winner, and one that has, has one.
  check ((completed_at is null) = (winning_team is null))
);

-- The four people who start a match, on the team they started on. Deleting an
-- account removes only that person's row, so their opponents' results stay.
create table public.ranked_match_participants (
  match_id uuid not null references public.ranked_matches(match_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team smallint not null check (team in (0, 1)),
  -- Set when the match ends and this person is not seated on the team they
  -- started on: they left and did not come back, or came back on the other
  -- side. A forfeited match counts as a loss whatever the result.
  forfeited boolean not null default false,
  primary key (match_id, user_id)
);

create index ranked_match_participants_user_idx
  on public.ranked_match_participants (user_id);
create index ranked_matches_completed_mode_idx
  on public.ranked_matches (mode)
  where completed_at is not null;

alter table public.ranked_matches enable row level security;
alter table public.ranked_match_participants enable row level security;
revoke all on public.ranked_matches from anon, authenticated;
revoke all on public.ranked_match_participants from anon, authenticated;

-- Runs inside the game-state write, so a match and its participants commit
-- with the save that starts the game, and the result with the save that ends
-- it. It does two things only: record who starts a match, and record how it
-- ended. It reads `rankingMatchId` and `gameOver.winningTeam` from state_data;
-- SupabaseGameStateRepository writes them under those names (its spec checks).
create or replace function meitra_private.capture_ranked_match()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_match_id uuid := (new.state_data->>'rankingMatchId')::uuid;
  v_winning_team integer;
begin
  if v_match_id is null then
    return new;
  end if;

  -- A match starts. Only one that four people start is ranked, so a game that
  -- begins with COM seats records nothing.
  if v_match_id is distinct from (old.state_data->>'rankingMatchId')::uuid
    and (
      select count(*) = 4
        and count(distinct rp.user_id) = 4
        and bool_and(not rp.is_com and rp.user_id is not null and rp.team in (0, 1))
      from public.room_players rp
      where rp.room_id = new.room_id
    )
  then
    insert into public.ranked_matches (match_id, mode)
    select v_match_id, coalesce(r.settings->>'gameMode', 'normal')
    from public.rooms r
    where r.id = new.room_id
    on conflict (match_id) do nothing;

    insert into public.ranked_match_participants (match_id, user_id, team)
    select v_match_id, rp.user_id, rp.team
    from public.room_players rp
    where rp.room_id = new.room_id
    on conflict do nothing;
  end if;

  if new.state_data->'gameOver' is null
    or new.state_data->'gameOver' = 'null'::jsonb
    or old.state_data->'gameOver' is not distinct from new.state_data->'gameOver'
  then
    return new;
  end if;

  -- The match ends. The winning team is recorded, and anyone not seated on
  -- the team they started on forfeits. A COM covering a dropped connection
  -- keeps its owner's user_id, so that owner is still seated.
  v_winning_team := (new.state_data #>> '{gameOver,winningTeam}')::integer;
  if v_winning_team is null or v_winning_team not in (0, 1) then
    return new;
  end if;

  update public.ranked_matches
  set winning_team = v_winning_team,
      completed_at = now()
  where match_id = v_match_id
    and completed_at is null;
  if not found then
    return new;
  end if;

  update public.ranked_match_participants p
  set forfeited = true
  where p.match_id = v_match_id
    and not exists (
      select 1
      from public.room_players rp
      where rp.room_id = new.room_id
        and rp.user_id = p.user_id
        and rp.team = p.team
    );
  return new;
end;
$$;

create trigger capture_ranked_match
after update of state_data on public.game_states
for each row execute function meitra_private.capture_ranked_match();

create or replace function public.get_win_rate_leaderboard(
  p_mode text,
  p_viewer_id uuid
) returns jsonb
language plpgsql security definer stable
set search_path = pg_catalog, public
as $$
declare
  -- The only place the qualifying match count is set; clients read it from the result.
  v_minimum_games constant integer := 10;
  result jsonb;
begin
  if p_mode not in ('normal', 'pro') then
    raise exception 'invalid ranking mode';
  end if;

  with totals as (
    select p.user_id, count(*)::integer as games_played,
           count(*) filter (
             where p.team = m.winning_team and not p.forfeited
           )::integer as games_won
    from public.ranked_match_participants p
    join public.ranked_matches m on m.match_id = p.match_id
    where m.mode = p_mode and m.completed_at is not null
    group by p.user_id
  ), eligible as (
    select t.*, pr.display_name, pr.avatar_url
    from totals t
    join auth.users u on u.id = t.user_id and u.is_anonymous = false
    join public.user_profiles pr on pr.id = t.user_id
      and pr.account_deletion_started_at is null
    where t.games_played >= v_minimum_games
  ), ranked as (
    select e.*, rank() over (
      order by e.games_won::numeric / e.games_played desc
    )::integer as rank,
    row_number() over (
      order by e.games_won::numeric / e.games_played desc,
               e.games_won desc, e.user_id
    ) as position
    from eligible e
  )
  select jsonb_build_object(
    'minimum_games', v_minimum_games,
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', user_id, 'display_name', display_name,
        'avatar_url', avatar_url, 'rank', rank,
        'games_played', games_played, 'games_won', games_won,
        'win_rate', round(100.0 * games_won / games_played, 1)
      ) order by position)
      from ranked where position <= 100
    ), '[]'::jsonb),
    'me', (
      select jsonb_build_object(
        'user_id', p_viewer_id, 'rank', r.rank,
        'games_played', t.games_played, 'games_won', t.games_won,
        'win_rate', round(100.0 * t.games_won / nullif(t.games_played, 0), 1)
      )
      from totals t left join ranked r on r.user_id = t.user_id
      where t.user_id = p_viewer_id
    )
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_win_rate_leaderboard(text, uuid) from public, anon, authenticated;
grant execute on function public.get_win_rate_leaderboard(text, uuid) to service_role;
