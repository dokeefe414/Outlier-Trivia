-- v1.0 CI only: launch is blocked by malformed private content.
do $v1_integrity$
declare
  v_before jsonb;
  v_after jsonb;
  v_user uuid:='77777777-7777-4777-8777-777777777777';
begin
  v_before:=public.outlier_launch_readiness();
  if v_before->>'ready'<>'true' then
    raise exception 'fixture should pass validated private readiness: %',v_before;
  end if;
  if not private.outlier_ranked_row_valid('rare',
      (select answers from private.ranked_question_bank where kind='rare' limit 1),
      '[]'::jsonb) then
    raise exception 'valid rare rows must be recognized'; end if;
  if private.outlier_ranked_row_valid('rare','[["Only One",50,[]]]'::jsonb,'[]'::jsonb) then
    raise exception 'rare bank with one answer wrongly accepted'; end if;
  if private.outlier_ranked_row_valid('fit','[]'::jsonb,
    '[["A",25],["B",25],["C",25],["D",25],["E",25],["F",25]]'::jsonb) then
    raise exception 'Fit In percentages over 100 accepted';end if;
  if private.outlier_ranked_row_valid('fit','[]'::jsonb,
    '[["A",20],["A",20],["C",20],["D",20],["E",10],["F",10]]'::jsonb) then
    raise exception 'duplicate Fit In option accepted';end if;
  insert into private.ranked_question_bank(id,kind,pool_group,category,prompt,detail,answers,choices)
    values('rq_malformed_quality_gate','rare','geo','GEOGRAPHY',
      'Name a fictional valid planet in the Solar System','A deliberately bad CI fixture',
      '[["Only One",100,[]]]'::jsonb,'[]'::jsonb);
  v_after:=public.outlier_launch_readiness();
  if v_after->>'ready'<>'false'
     or (v_after->>'invalidQuestions')::integer<1 then
    raise exception 'invalid private content failed to block launch: %',v_after;
  end if;
  insert into auth.users(id,email) values(v_user,'integrity-gate@example.test');
  begin
    perform public.outlier_start(v_user,'daily');
    raise exception 'server started official game despite bad private content';
  exception when others then
    if sqlerrm='server started official game despite bad private content' then raise;end if;
    if position('private_question_bank_not_configured' in sqlerrm)=0 then raise;end if;
  end;
  delete from private.ranked_question_bank where id='rq_malformed_quality_gate';
  if public.outlier_launch_readiness()->>'ready'<>'true' then
    raise exception 'launch readiness did not recover after invalid row removal';end if;
  if has_function_privilege('authenticated',
     'private.outlier_ranked_row_valid(text,jsonb,jsonb)','EXECUTE') then
    raise exception 'private validator executable by untrusted users';end if;
  raise notice 'v1.0 validated coverage, malformed content block, and recovery passed';
end $v1_integrity$;

do $v1_community$
declare
  v_league uuid;
  v_user uuid;
  v_previous jsonb;
  v_quality jsonb;
begin
  select league_id,user_id into v_league,v_user
    from public.friend_league_members order by joined_at limit 1;
  if v_league is null then raise exception 'no test friend league';end if;
  insert into public.game_attempts(
    user_id,mode,game_day,question_ids,answers,next_index,score,completed_at)
    values(v_user,'daily',
      date_trunc('week',clock_timestamp() at time zone 'UTC')::date-3,
      array['rq_score_1','rq_score_2','rq_score_3','rq_score_4',
      'rq_score_5','rq_score_6','rq_score_7'],
      '[]'::jsonb,7,6800,clock_timestamp()-interval '3 days')
    on conflict do nothing;
  -- In case test day was already used, reuse last week's existing score.
  v_previous:=public.outlier_league_standings(v_user,v_league,'last-week');
  if jsonb_array_length(v_previous)<1 then
    raise exception 'last-week standings are missing members';end if;
  if (v_previous->0->>'score')::integer<0 then
    raise exception 'negative weekly score';end if;
  v_quality:=public.outlier_beta_quality_metrics();
  if v_quality->>'rejectedGuesses' is null
    or v_quality->>'gamesWithRejectedGuesses' is null then
    raise exception 'beta quality metrics missing required totals';end if;
  if has_function_privilege('authenticated',
    'public.outlier_beta_quality_metrics()','EXECUTE') then
    raise exception 'beta quality metrics are exposed to players';end if;
  begin
    perform public.outlier_league_standings(
      '33333333-3333-4333-8333-333333333333',v_league,'last-week');
    raise exception 'outsider accessed private historical league';
  exception when others then
    if sqlerrm='outsider accessed private historical league' then raise;end if;
    if position('not_a_league_member' in sqlerrm)=0 then raise;end if;
  end;
  raise notice 'v1.0 member-only previous week and privacy-safe quality metrics passed';
end $v1_community$;
