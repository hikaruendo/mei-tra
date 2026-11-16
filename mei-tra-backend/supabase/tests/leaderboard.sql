begin;

-- Records a finished match directly, for the leaderboard tests below.
create function pg_temp.finish_match(
  p_mode text,
  p_team0 uuid[],
  p_team1 uuid[],
  p_winning_team integer
) returns void
language plpgsql
as $$
declare
  v_match_id uuid := gen_random_uuid();
begin
  insert into public.ranked_matches (match_id, mode, completed_at, winning_team)
  values (v_match_id, p_mode, now(), p_winning_team);
  insert into public.ranked_match_participants (match_id, user_id, team)
  select v_match_id, member, 0 from unnest(p_team0) as member
  union all
  select v_match_id, member, 1 from unnest(p_team1) as member;
end;
$$;

do $test$
declare
  players uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  leaderboard_users uuid[];
  result jsonb;
  i integer;
  group_index integer;
  round_index integer;
begin
  insert into auth.users (id, aud, role, is_anonymous)
  select id, 'authenticated', 'authenticated', false from unnest(players) as id;

  for i in 1..9 loop
    perform pg_temp.finish_match('normal',
      array[players[1], players[3]], array[players[2], players[4]], 0);
  end loop;

  result := public.get_win_rate_leaderboard('normal', players[1]);
  if (result->>'minimumGames')::integer is distinct from 10 then
    raise exception 'The qualifying match count was not returned: %', result;
  end if;
  if jsonb_array_length(result->'entries') <> 0 then
    raise exception 'Players ranked before 10 matches';
  end if;
  if jsonb_array_length(public.get_win_rate_leaderboard('pro', players[1])->'entries') <> 0 then
    raise exception 'Mode results were combined';
  end if;

  -- An unfinished match counts for nobody.
  insert into public.ranked_matches (match_id, mode)
  values ('00000000-0000-0000-0000-0000000000aa', 'normal');
  insert into public.ranked_match_participants (match_id, user_id, team)
  select '00000000-0000-0000-0000-0000000000aa', players[n], (n - 1) % 2
  from generate_series(1, 4) as n;
  if jsonb_array_length(public.get_win_rate_leaderboard('normal', players[1])->'entries') <> 0 then
    raise exception 'An unfinished match was counted';
  end if;

  perform pg_temp.finish_match('normal',
    array[players[1], players[3]], array[players[2], players[4]], 0);

  result := public.get_win_rate_leaderboard('normal', players[1]);
  if jsonb_array_length(result->'entries') <> 4
     or (result->'entries'->0->>'rank')::integer <> 1
     or (result->'entries'->1->>'rank')::integer <> 1
     or (result->'entries'->2->>'rank')::integer <> 3
     or (result->'me'->>'gamesPlayed')::integer <> 10
     or (result->'me'->>'gamesWon')::integer <> 10 then
    raise exception 'Incorrect ranks or stats: %', result;
  end if;

  update auth.users set is_anonymous = true where id = players[1];
  if jsonb_array_length(public.get_win_rate_leaderboard('normal', players[1])->'entries') <> 3 then
    raise exception 'Guest appeared in ranking';
  end if;
  update auth.users set is_anonymous = false where id = players[1];
  if jsonb_array_length(public.get_win_rate_leaderboard('normal', players[1])->'entries') <> 4 then
    raise exception 'Upgraded guest was not ranked';
  end if;

  -- Deleting an account removes that person's rows only; their opponents and
  -- partner keep their results.
  delete from auth.users where id = players[1];
  if exists (select 1 from public.ranked_match_participants where user_id = players[1]) then
    raise exception 'Deleted account retained ranking rows';
  end if;
  result := public.get_win_rate_leaderboard('normal', players[2]);
  if jsonb_array_length(result->'entries') <> 3
     or (result->'me'->>'gamesPlayed')::integer <> 10 then
    raise exception 'A deleted account removed other players results: %', result;
  end if;

  select array_agg((lpad(to_hex(n), 8, '0') || '-0000-0000-0000-000000000000')::uuid order by n)
    into leaderboard_users from generate_series(1, 104) as n;
  insert into auth.users (id, aud, role, is_anonymous)
  select id, 'authenticated', 'authenticated', false from unnest(leaderboard_users) as id;
  for group_index in 0..25 loop
    for round_index in 1..10 loop
      perform pg_temp.finish_match('pro',
        array[leaderboard_users[group_index * 4 + 1], leaderboard_users[group_index * 4 + 3]],
        array[leaderboard_users[group_index * 4 + 2], leaderboard_users[group_index * 4 + 4]],
        case when round_index <= 5 then 0 else 1 end);
    end loop;
  end loop;
  result := public.get_win_rate_leaderboard('pro', leaderboard_users[104]);
  if jsonb_array_length(result->'entries') <> 100
     or (result->'me'->>'rank')::integer <> 1
     or exists (select 1 from jsonb_array_elements(result->'entries') as entry
                where entry->>'userId' = leaderboard_users[104]::text) then
    raise exception 'Top 100 or out-of-range self result is incorrect';
  end if;
end
$test$;

-- A forfeited match counts as played and lost, even when that team won.
do $forfeit_test$
declare
  players uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  result jsonb;
  i integer;
begin
  insert into auth.users (id, aud, role, is_anonymous)
  select id, 'authenticated', 'authenticated', false from unnest(players) as id;
  for i in 1..10 loop
    perform pg_temp.finish_match('normal',
      array[players[1], players[3]], array[players[2], players[4]], 0);
  end loop;
  update public.ranked_match_participants set forfeited = true
  where user_id = players[1]
    and match_id = (select match_id from public.ranked_match_participants
                    where user_id = players[1] limit 1);

  result := public.get_win_rate_leaderboard('normal', players[1]);
  if (result->'me'->>'gamesPlayed')::integer <> 10
     or (result->'me'->>'gamesWon')::integer <> 9 then
    raise exception 'A forfeited win was not counted as a loss: %', result;
  end if;
  result := public.get_win_rate_leaderboard('normal', players[3]);
  if (result->'me'->>'gamesWon')::integer <> 10 then
    raise exception 'One player forfeiting changed their partner''s result: %', result;
  end if;
end
$forfeit_test$;

-- Exercise the real game-state write path: a match and its participants are
-- recorded when the game starts, and when it ends the winning team, plus a
-- forfeit for anyone not seated on the team they started on.
do $trigger_test$
declare
  -- players[5] is not seated at the start; they take over a seat mid-match.
  players uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  test_room_id uuid := gen_random_uuid();
  match_one uuid := gen_random_uuid();
  match_com uuid := gen_random_uuid();
  match_dropped uuid := gen_random_uuid();
  match_returned uuid := gen_random_uuid();
  match_switched uuid := gen_random_uuid();
  match_substitute uuid := gen_random_uuid();
  match_deleted uuid := gen_random_uuid();
  match_failed uuid := gen_random_uuid();
  finished_at timestamptz;
begin
  insert into auth.users (id, aud, role, is_anonymous)
  select id, 'authenticated', 'authenticated', false from unnest(players) as id;
  insert into public.rooms (id, name, status, settings)
  values (test_room_id, 'Leaderboard trigger test', 'playing', '{"gameMode":"pro"}');
  -- Seats 0 and 2 are team 0, seats 1 and 3 are team 1.
  insert into public.room_players (room_id, name, user_id, team, seat_index)
  select test_room_id, 'Player ' || n, players[n], (n - 1) % 2, n - 1
  from generate_series(1, 4) as n;
  insert into public.game_states (room_id, state_data)
  values (test_room_id, jsonb_build_object('rankingMatchId', null, 'gameOver', null));

  -- Four people start a match: it is recorded with the room's mode.
  update public.game_states
  set state_data = state_data || jsonb_build_object('rankingMatchId', match_one)
  where game_states.room_id = test_room_id;
  if (select mode from public.ranked_matches where match_id = match_one) is distinct from 'pro'
    or (select completed_at from public.ranked_matches where match_id = match_one) is not null
    or (select count(*) from public.ranked_match_participants where match_id = match_one) <> 4 then
    raise exception 'Match start did not record the match and its four participants';
  end if;

  -- Player 2 leaves and a COM finishes the seat; their team wins, but player 2
  -- forfeits because they are no longer seated.
  update public.room_players set is_com = true, user_id = null
  where room_players.room_id = test_room_id and seat_index = 1;
  update public.game_states
  set state_data = jsonb_set(state_data, '{gameOver}', '{"winningTeam":1}')
  where game_states.room_id = test_room_id;
  select completed_at into finished_at from public.ranked_matches where match_id = match_one;
  if finished_at is null
    or (select winning_team from public.ranked_matches where match_id = match_one) <> 1 then
    raise exception 'Game over did not record the winning team';
  end if;
  if not (select forfeited from public.ranked_match_participants
          where match_id = match_one and user_id = players[2])
    or (select count(*) from public.ranked_match_participants
        where match_id = match_one and forfeited) <> 1 then
    raise exception 'Only the player who left should forfeit';
  end if;

  -- Saving the same game over again changes nothing.
  update public.game_states
  set state_data = jsonb_set(state_data, '{gameOver}', '{"winningTeam":0}')
  where game_states.room_id = test_room_id;
  if (select winning_team from public.ranked_matches where match_id = match_one) <> 1
    or (select completed_at from public.ranked_matches where match_id = match_one) <> finished_at then
    raise exception 'A repeated game-over save changed the result';
  end if;

  -- A match that starts with a COM seat (seat 1 is still COM) is not ranked.
  update public.game_states
  set state_data = jsonb_build_object('rankingMatchId', match_com, 'gameOver', null)
  where game_states.room_id = test_room_id;
  update public.game_states
  set state_data = jsonb_set(state_data, '{gameOver}', '{"winningTeam":0}')
  where game_states.room_id = test_room_id;
  if exists (select 1 from public.ranked_matches where match_id = match_com) then
    raise exception 'A match that started with a COM seat was ranked';
  end if;

  -- Player 2's connection drops and a COM covers the seat under their account:
  -- they are still seated, so they do not forfeit.
  update public.room_players set is_com = false, user_id = players[2]
  where room_players.room_id = test_room_id and seat_index = 1;
  update public.game_states
  set state_data = jsonb_build_object('rankingMatchId', match_dropped, 'gameOver', null)
  where game_states.room_id = test_room_id;
  update public.room_players set is_com = true
  where room_players.room_id = test_room_id and seat_index = 1;
  update public.game_states
  set state_data = jsonb_set(state_data, '{gameOver}', '{"winningTeam":1}')
  where game_states.room_id = test_room_id;
  if exists (select 1 from public.ranked_match_participants
             where match_id = match_dropped and forfeited) then
    raise exception 'A dropped connection covered by a COM was treated as leaving';
  end if;

  -- Player 2 leaves and comes back to their own seat before the end.
  update public.room_players set is_com = false
  where room_players.room_id = test_room_id and seat_index = 1;
  update public.game_states
  set state_data = jsonb_build_object('rankingMatchId', match_returned, 'gameOver', null)
  where game_states.room_id = test_room_id;
  update public.room_players set is_com = true, user_id = null
  where room_players.room_id = test_room_id and seat_index = 1;
  update public.room_players set is_com = false, user_id = players[2]
  where room_players.room_id = test_room_id and seat_index = 1;
  update public.game_states
  set state_data = jsonb_set(state_data, '{gameOver}', '{"winningTeam":1}')
  where game_states.room_id = test_room_id;
  if exists (select 1 from public.ranked_match_participants
             where match_id = match_returned and forfeited) then
    raise exception 'A player who came back to their team forfeited';
  end if;

  -- Players 1 and 2 end the match on each other's team: both forfeit.
  update public.game_states
  set state_data = jsonb_build_object('rankingMatchId', match_switched, 'gameOver', null)
  where game_states.room_id = test_room_id;
  update public.room_players set team = 1 - team
  where room_players.room_id = test_room_id and seat_index in (0, 1);
  update public.game_states
  set state_data = jsonb_set(state_data, '{gameOver}', '{"winningTeam":0}')
  where game_states.room_id = test_room_id;
  if (select array_agg(user_id order by user_id) from public.ranked_match_participants
      where match_id = match_switched and forfeited)
     is distinct from (select array_agg(id order by id) from unnest(array[players[1], players[2]]) as id) then
    raise exception 'Players who ended on the other team did not forfeit';
  end if;
  update public.room_players set team = 1 - team
  where room_players.room_id = test_room_id and seat_index in (0, 1);

  -- Someone else takes over player 2's seat and finishes it. Player 2 left, so
  -- they forfeit, and the newcomer gets nothing.
  update public.game_states
  set state_data = jsonb_build_object('rankingMatchId', match_substitute, 'gameOver', null)
  where game_states.room_id = test_room_id;
  update public.room_players set user_id = players[5]
  where room_players.room_id = test_room_id and seat_index = 1;
  update public.game_states
  set state_data = jsonb_set(state_data, '{gameOver}', '{"winningTeam":1}')
  where game_states.room_id = test_room_id;
  if not coalesce((select forfeited from public.ranked_match_participants
                   where match_id = match_substitute and user_id = players[2]), false)
    or exists (select 1 from public.ranked_match_participants
               where match_id = match_substitute and user_id = players[5])
    or (select completed_at from public.ranked_matches where match_id = match_substitute) is null then
    raise exception 'A substitute changed the result of the player who left';
  end if;

  -- A participant deletes their account mid-match; the others still get the result.
  update public.room_players set user_id = players[2]
  where room_players.room_id = test_room_id and seat_index = 1;
  update public.game_states
  set state_data = jsonb_build_object('rankingMatchId', match_deleted, 'gameOver', null)
  where game_states.room_id = test_room_id;
  delete from auth.users where id = players[4];
  update public.game_states
  set state_data = jsonb_set(state_data, '{gameOver}', '{"winningTeam":0}')
  where game_states.room_id = test_room_id;
  if (select count(*) from public.ranked_match_participants where match_id = match_deleted) <> 3
    or (select completed_at from public.ranked_matches where match_id = match_deleted) is null then
    raise exception 'A deleted participant stopped the others from getting the result';
  end if;

  -- A failed ranking write rolls the game-start save back with it.
  insert into auth.users (id, aud, role, is_anonymous)
  values (players[4], 'authenticated', 'authenticated', false);
  update public.room_players set user_id = players[4]
  where room_players.room_id = test_room_id and seat_index = 3;
  update public.rooms set settings = '{"gameMode":"invalid"}' where id = test_room_id;
  begin
    update public.game_states
    set state_data = jsonb_build_object('rankingMatchId', match_failed, 'gameOver', null)
    where game_states.room_id = test_room_id;
    raise exception 'Expected the ranking write to fail';
  exception when others then
    if sqlerrm = 'Expected the ranking write to fail' then raise; end if;
  end;
  if (select state_data->>'rankingMatchId' from public.game_states
      where game_states.room_id = test_room_id) = match_failed::text
    or exists (select 1 from public.ranked_matches where match_id = match_failed) then
    raise exception 'A failed ranking write committed the game-start snapshot';
  end if;
end
$trigger_test$;

rollback;
