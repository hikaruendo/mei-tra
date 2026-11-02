begin;

do $test$
declare
  players uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  first_match uuid := gen_random_uuid();
  leaderboard_users uuid[];
  result jsonb;
  i integer;
  group_index integer;
  round_index integer;
begin
  insert into auth.users (id, aud, role, is_anonymous)
  select id, 'authenticated', 'authenticated', false from unnest(players) as id;

  for i in 1..9 loop
    perform public.record_ranked_match(
      case when i = 1 then first_match else gen_random_uuid() end,
      'normal',
      jsonb_build_array(
        jsonb_build_object('user_id', players[1], 'won', true),
        jsonb_build_object('user_id', players[2], 'won', false),
        jsonb_build_object('user_id', players[3], 'won', true),
        jsonb_build_object('user_id', players[4], 'won', false)
      )
    );
  end loop;

  result := public.get_win_rate_leaderboard('normal', players[1]);
  if jsonb_array_length(result->'entries') <> 0 then
    raise exception 'Players ranked before 10 matches';
  end if;
  if jsonb_array_length(public.get_win_rate_leaderboard('pro', players[1])->'entries') <> 0 then
    raise exception 'Mode results were combined';
  end if;

  perform public.record_ranked_match(gen_random_uuid(), 'normal', jsonb_build_array(
    jsonb_build_object('user_id', players[1], 'won', true),
    jsonb_build_object('user_id', players[2], 'won', false),
    jsonb_build_object('user_id', players[3], 'won', true),
    jsonb_build_object('user_id', players[4], 'won', false)
  ));
  perform public.record_ranked_match(first_match, 'normal', jsonb_build_array(
    jsonb_build_object('user_id', players[1], 'won', true),
    jsonb_build_object('user_id', players[2], 'won', false),
    jsonb_build_object('user_id', players[3], 'won', true),
    jsonb_build_object('user_id', players[4], 'won', false)
  ));
  if (select count(*) from public.ranking_results) <> 40 then
    raise exception 'A duplicate match was counted';
  end if;

  result := public.get_win_rate_leaderboard('normal', players[1]);
  if jsonb_array_length(result->'entries') <> 4
     or (result->'entries'->0->>'rank')::integer <> 1
     or (result->'entries'->1->>'rank')::integer <> 1
     or (result->'entries'->2->>'rank')::integer <> 3
     or (result->'me'->>'gamesPlayed')::integer <> 10 then
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

  delete from auth.users where id = players[1];
  if (select count(*) from public.ranking_results) <> 30 then
    raise exception 'Deleted account retained ranking results';
  end if;

  select array_agg((lpad(to_hex(n), 8, '0') || '-0000-0000-0000-000000000000')::uuid order by n)
    into leaderboard_users from generate_series(1, 104) as n;
  insert into auth.users (id, aud, role, is_anonymous)
  select id, 'authenticated', 'authenticated', false from unnest(leaderboard_users) as id;
  for group_index in 0..25 loop
    for round_index in 1..10 loop
      perform public.record_ranked_match(gen_random_uuid(), 'pro', jsonb_build_array(
        jsonb_build_object('user_id', leaderboard_users[group_index * 4 + 1], 'won', round_index <= 5),
        jsonb_build_object('user_id', leaderboard_users[group_index * 4 + 2], 'won', round_index > 5),
        jsonb_build_object('user_id', leaderboard_users[group_index * 4 + 3], 'won', round_index <= 5),
        jsonb_build_object('user_id', leaderboard_users[group_index * 4 + 4], 'won', round_index > 5)
      ));
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

rollback;
