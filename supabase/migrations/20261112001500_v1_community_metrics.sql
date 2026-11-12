-- OUTLIER v1.0: finished friend-league weeks and privacy-safe beta quality.
-- Results use server-verified completed official daily scores only.
create or replace function public.outlier_league_standings(p_user uuid,p_league uuid,p_period text default 'week')
returns jsonb language plpgsql stable security definer
set search_path=public,private,pg_temp as $$
declare v_result jsonb;
begin
  if p_period not in ('today','week','last-week','all') then raise exception 'invalid_period'; end if;
  if not exists(select 1 from public.friend_league_members
      where league_id=p_league and user_id=p_user) then
    raise exception 'not_a_league_member';
  end if;
  with scoreboard as (
    select m.user_id,p.display_name,
      count(g.id)::int as days,
      coalesce(sum(g.score),0)::bigint as points
    from public.friend_league_members m
    join public.profiles p on p.user_id=m.user_id
    left join public.game_attempts g on g.user_id=m.user_id
      and g.mode='daily' and g.completed_at is not null
      and (p_period='all'
        or (p_period='today' and g.game_day=(clock_timestamp() at time zone 'UTC')::date)
        or (p_period='week' and g.game_day>=date_trunc('week',clock_timestamp() at time zone 'UTC')::date
          and g.game_day<date_trunc('week',clock_timestamp() at time zone 'UTC')::date+7)
        or (p_period='last-week' and
          g.game_day>=date_trunc('week',clock_timestamp() at time zone 'UTC')::date-7
          and g.game_day<date_trunc('week',clock_timestamp() at time zone 'UTC')::date))
    where m.league_id=p_league
    group by m.user_id,p.display_name
  ), ranked as (
    select row_number() over(order by points desc,days desc,user_id)::int as position,
      user_id,display_name,days,points from scoreboard
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'position',position,'userId',user_id,'name',display_name,'days',days,'score',points
  ) order by position),'[]'::jsonb)
  into v_result from ranked;
  return v_result;
end $$;

revoke all on function public.outlier_league_standings(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.outlier_league_standings(uuid,uuid,text)
  to service_role;

-- A useful aggregated signal: are players finding valid answers?
-- Never exposes raw guesses, emails or per-question frequencies.
create or replace function public.outlier_beta_quality_metrics()
returns jsonb language sql stable security definer
set search_path=public,private,pg_temp as $$
  with window as (
    select date_trunc('week',clock_timestamp() at time zone 'UTC') as starts_at
  ), rejected as (
    select count(*)::int as affected_question_rounds,
      coalesce(sum(g.guess_count),0)::bigint as rejected_guesses,
      count(distinct g.attempt_id)::int as affected_attempts
    from private.outlier_rejected_guesses g cross join window w
    where g.updated_at >= w.starts_at
  ), attempts as (
    select count(*)::int as completed_this_week
    from public.game_attempts a cross join window w
    where a.mode='daily' and a.completed_at >= w.starts_at
  ), moderation as (
    select count(*) filter(where status='pending')::int as pending,
      count(*) filter(where status='approved')::int as approved,
      count(*) filter(where status='rejected')::int as rejected
    from public.answer_reviews
  )
  select jsonb_build_object(
    'weekStart',(select starts_at::date from window),
    'rejectedQuestionRounds',r.affected_question_rounds,
    'rejectedGuesses',r.rejected_guesses,
    'gamesWithRejectedGuesses',r.affected_attempts,
    'officialDailiesCompleted',a.completed_this_week,
    'pendingAnswerReviews',m.pending,
    'approvedAnswerReviews',m.approved,
    'rejectedAnswerReviews',m.rejected,
    'note','Private owner totals. Rejected does not mean truly invalid; human verification required.'
  )
  from rejected r cross join attempts a cross join moderation m
$$;
revoke all on function public.outlier_beta_quality_metrics()
  from public,anon,authenticated;
grant execute on function public.outlier_beta_quality_metrics() to service_role;
