-- Ranking results are independent of the short-lived room/history retention.
-- The match ID is generated at game start, so a rematch in the same room is distinct.
create table public.ranking_results (
  match_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('normal', 'pro')),
  won boolean not null,
  completed_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

create index ranking_results_mode_user_idx on public.ranking_results (mode, user_id);
alter table public.ranking_results enable row level security;
revoke all on public.ranking_results from anon, authenticated;

-- The four people who start a match. A player who leaves is replaced by a COM
-- that finishes the seat, and the result of that seat still goes to them.
create table public.ranked_match_participants (
  match_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  team smallint not null check (team in (0, 1)),
  primary key (match_id, user_id)
);

alter table public.ranked_match_participants enable row level security;
revoke all on public.ranked_match_participants from anon, authenticated;

create or replace function public.record_ranked_match(
  p_match_id uuid,
  p_mode text,
  p_players jsonb
) returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if p_match_id is null or p_mode not in ('normal', 'pro')
    or jsonb_typeof(p_players) <> 'array' or jsonb_array_length(p_players) <> 4
    or (select count(distinct user_id) from jsonb_to_recordset(p_players)
        as p(user_id uuid, won boolean)) <> 4
    or exists (select 1 from jsonb_to_recordset(p_players)
        as p(user_id uuid, won boolean) where user_id is null or won is null)
  then
    raise exception 'invalid ranked match';
  end if;

  -- A function call is one transaction: retries cannot leave a partial match.
  if exists (select 1 from public.ranking_results where match_id = p_match_id) then
    return;
  end if;

  insert into public.ranking_results (match_id, user_id, mode, won)
  select p_match_id, p.user_id, p_mode, p.won
  from jsonb_to_recordset(p_players) as p(user_id uuid, won boolean)
  on conflict do nothing;
end;
$$;

-- Runs inside the game-state write. The participants commit with the save that
-- starts the match, and the result with the save that ends it, so a failed
-- ranking write cannot silently leave an unranked finished match behind.
create or replace function meitra_private.capture_ranked_match()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_match_id uuid := (new.state_data->>'rankingMatchId')::uuid;
  v_winning_team integer;
  v_mode text;
  v_players jsonb;
  v_participant_count integer;
begin
  if v_match_id is null then
    return new;
  end if;

  -- A match starts. Only one that four people start is ranked, so a game that
  -- begins with COM seats records no participants.
  if v_match_id is distinct from (old.state_data->>'rankingMatchId')::uuid
    and (
      select count(*) = 4
        and count(distinct rp.user_id) = 4
        and bool_and(not rp.is_com and rp.user_id is not null and rp.team in (0, 1))
      from public.room_players rp
      where rp.room_id = new.room_id
    )
  then
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

  -- The match ends. Each participant gets the result of the team they started
  -- on, whoever is in the seat now.
  v_winning_team := (new.state_data #>> '{gameOver,winningTeam}')::integer;
  select count(*),
         jsonb_agg(jsonb_build_object('user_id', p.user_id,
           'won', p.team = v_winning_team))
    into v_participant_count, v_players
  from public.ranked_match_participants p
  where p.match_id = v_match_id;

  if v_winning_team in (0, 1) and v_participant_count = 4 then
    select coalesce(r.settings->>'gameMode', 'normal') into v_mode
    from public.rooms r where r.id = new.room_id;
    perform public.record_ranked_match(v_match_id, v_mode, v_players);
  end if;
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
declare result jsonb;
begin
  if p_mode not in ('normal', 'pro') then
    raise exception 'invalid ranking mode';
  end if;

  with totals as (
    select r.user_id, count(*)::integer as games_played,
           count(*) filter (where r.won)::integer as games_won
    from public.ranking_results r
    where r.mode = p_mode
    group by r.user_id
  ), eligible as (
    select t.*, p.display_name, p.avatar_url
    from totals t
    join auth.users u on u.id = t.user_id and u.is_anonymous = false
    join public.user_profiles p on p.id = t.user_id
      and p.account_deletion_started_at is null
    where t.games_played >= 10
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
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', user_id, 'displayName', display_name,
        'avatarUrl', avatar_url, 'rank', rank,
        'gamesPlayed', games_played, 'gamesWon', games_won,
        'winRate', round(100.0 * games_won / games_played, 1)
      ) order by position)
      from ranked where position <= 100
    ), '[]'::jsonb),
    'me', (
      select jsonb_build_object(
        'userId', p_viewer_id, 'rank', r.rank,
        'gamesPlayed', t.games_played, 'gamesWon', t.games_won,
        'winRate', round(100.0 * t.games_won / nullif(t.games_played, 0), 1)
      )
      from totals t left join ranked r on r.user_id = t.user_id
      where t.user_id = p_viewer_id
    )
  ) into result;
  return result;
end;
$$;

revoke all on function public.record_ranked_match(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.get_win_rate_leaderboard(text, uuid) from public, anon, authenticated;
grant execute on function public.record_ranked_match(uuid, text, jsonb) to service_role;
grant execute on function public.get_win_rate_leaderboard(text, uuid) to service_role;
