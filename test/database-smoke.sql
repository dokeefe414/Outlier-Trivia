-- Run after creating the auth schema/roles and applying both migrations.
insert into auth.users (id,email) values
('11111111-1111-4111-8111-111111111111','tester@example.test');
do $outlier_test$
declare
  u uuid := '11111111-1111-4111-8111-111111111111'::uuid;
  g uuid;
  practice uuid;
  s jsonb;
  result jsonb;
  qid text;
  answer text;
  i integer;
  leaderboard jsonb;
  stats jsonb;
begin
  g := public.outlier_start(u,'daily');
  if g is null then raise exception 'daily start did not return an id'; end if;
  if public.outlier_start(u,'daily') <> g then raise exception 'daily attempt was duplicated'; end if;
  s := public.outlier_state(u,g);
  if (select count(*) from private.question_bank where id like 'atlas-%') <> 39 then
    raise exception 'broad atlas seed must contain exactly 39 prompts';
  end if;
  if (select count(*) from private.question_bank where id like 'pack-%') <> 66 then
    raise exception 'missing broad entertainment/sports/wildlife question catalog';
  end if;
  if (select min(jsonb_array_length(answers)) from private.question_bank where id like 'pack-%') < 28 then
    raise exception 'content pack includes too few valid answers';
  end if;
  if (select count(*) from private.question_bank where id like 'fit-v05-%') <> 30 then
    raise exception 'missing new Fit In question boards';
  end if;
  if (select min(jsonb_array_length(answers)) from private.question_bank where id like 'atlas-%') < 36 then
    raise exception 'broad atlas contains an undersized answer pool';
  end if;
  if (select count(*) from unnest((select question_ids from public.game_attempts where id=g)) q(id)
      where q.id like 'atlas-%' or q.id like 'pack-%') <> 4 then
    raise exception 'official daily did not use four vetted broad Stand Out questions';
  end if;
  if s->>'index'<>'0' then raise exception 'unexpected starting index'; end if;
  if s->'question'->>'deadline' is null then raise exception 'first timer not started'; end if;
  if jsonb_typeof(s->'question'->'choices') <> 'null' then
    raise exception 'rare question should not leak answer list';
  end if;
  for i in 0..6 loop
    qid := s->'question'->>'id';
    select case when kind='rare' then answers->0->>0 else choices->0->>0 end
      into answer from private.question_bank where id=qid;
    if answer is null then raise exception 'missing answer for question %',qid; end if;
    result := public.outlier_answer(u,g,i,answer);
    s := result->'state';
    if (result->'feedback'->>'points')::integer <= 0 then
      raise exception 'server incorrectly rejected a valid answer %',answer;
    end if;
    if i < 6 then
      if s->'question'->>'deadline' is not null then
        raise exception 'timer advanced while player was reading feedback';
      end if;
      s := public.outlier_advance(u,g,i+1);
      if s->'question'->>'deadline' is null then raise exception 'advance did not start timer'; end if;
    end if;
  end loop;
  if s->>'complete'<>'true' or s->>'index'<>'7' then raise exception 'daily never completed'; end if;
  if (s->>'score')::int <= 0 or (s->>'score')::int > 7000 then
    raise exception 'invalid score range';
  end if;
  leaderboard:=public.outlier_leaderboard('daily',50);
  if jsonb_array_length(leaderboard)<>1 then raise exception 'daily board missing completed player'; end if;
  leaderboard:=public.outlier_leaderboard('average',50);
  if jsonb_array_length(leaderboard)<>0 then raise exception 'average eligibility threshold broken'; end if;
  stats:=public.outlier_player_stats(u);
  if (stats->>'days')::int<>1 then raise exception 'official daily count was wrong'; end if;
  begin
    practice:=public.outlier_start(u,'practice');
    raise exception 'unpaid practice unexpectedly allowed';
  exception when others then
    if sqlerrm='unpaid practice unexpectedly allowed' then raise; end if;
    if position('payment_required' in sqlerrm)=0 then
      raise exception 'unexpected practice error: %',sqlerrm;
    end if;
  end;
  insert into public.entitlements(user_id,unlimited)
  values (u,true);
  practice:=public.outlier_start(u,'practice');
  if practice is null then raise exception 'paid practice did not open'; end if;
  if (public.outlier_player_stats(u)->>'days')::int<>1 then
    raise exception 'practice changed the official daily ranking';
  end if;
  raise notice 'OUTLIER database smoke passed: one official run, scores, boards, timer pauses and entitlement';
end $outlier_test$;


-- Validate future 2026-11-16 through 2026-11-22 rounds now, without
-- altering the authoritative server clock or creating fake ranked attempts.
do $future_release$
declare
  v_day date;
  v_ids text[];
  v_all text[]:=array[]::text[];
  v_unique integer;
  v_group_count integer;
begin
  for v_day in select (date '2026-11-16' + d) from generate_series(0,6) d loop
    v_ids:=private.outlier_preview_daily_ids(v_day);
    if array_length(v_ids,1)<>7 then raise exception 'invalid future daily slate length for %',v_day; end if;
    if v_ids<>private.outlier_preview_daily_ids(v_day) then raise exception 'daily slate not deterministic %',v_day; end if;
    select count(*) into v_group_count from unnest(array[v_ids[1],v_ids[3],v_ids[5],v_ids[7]]) t(id)
    where id like 'atlas-%' or id like 'pack-%';
    if v_group_count<>4 then raise exception 'future day does not contain four broad questions %',v_day; end if;
    v_all:=v_all||v_ids;
  end loop;
  select count(distinct id)::int into v_unique from unnest(v_all) t(id);
  if v_unique<>49 then raise exception 'future week repeats question (% distinct of 49)',v_unique; end if;
  raise notice 'OUTLIER v0.5 future-schedule smoke passed: seven complete unique days';
end $future_release$;
