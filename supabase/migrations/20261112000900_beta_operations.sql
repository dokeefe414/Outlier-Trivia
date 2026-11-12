-- OUTLIER v0.7 beta operations: anonymized retention, release gate, and
-- a per-account request budget. Service role only, no user-facing raw data.
create table if not exists private.request_budgets (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  window_bucket bigint not null,
  hits integer not null default 1,
  primary key(user_id,action,window_bucket)
);
revoke all on private.request_budgets from public,anon,authenticated;

create or replace function public.outlier_request_budget(
  p_user uuid,p_action text,p_max integer,p_window_seconds integer
) returns boolean language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare v_hits integer; v_bucket bigint;
begin
  if p_action not in ('start','answer','advance','league-create','league-join','review','checkout','name')
    or p_max not between 1 and 120 or p_window_seconds not between 30 and 86400 then
    raise exception 'invalid_rate_limit_config';
  end if;
  v_bucket:=floor(extract(epoch from clock_timestamp())/p_window_seconds)::bigint;
  insert into private.request_budgets(user_id,action,window_bucket,hits)
    values(p_user,p_action,v_bucket,1)
    on conflict(user_id,action,window_bucket)
    do update set hits=private.request_budgets.hits+1
    returning hits into v_hits;
  return v_hits<=p_max;
end $$;
revoke all on function public.outlier_request_budget(uuid,text,integer,integer)
  from public,anon,authenticated;
grant execute on function public.outlier_request_budget(uuid,text,integer,integer)
  to service_role;

create or replace function public.outlier_launch_readiness()
returns jsonb language sql stable security definer
set search_path=public,private,pg_temp as $$
  with required(pool_group,minimum) as (
    values ('geo',3),('science',2),('wild',2),('movies',2),
      ('tv',2),('music',3),('sports',3),('animals',3),
      ('food',2),('games',2),('history',2),('people',2),('fit',21)
  ), groups as (
    select r.pool_group,r.minimum,count(q.id)::int as available
    from required r left join private.ranked_question_bank q
      on q.pool_group=r.pool_group
    group by r.pool_group,r.minimum
  )
  select jsonb_build_object(
    'ready',coalesce(bool_and(available>=minimum),false),
    'privateQuestions',coalesce(sum(available),0),
    'missing',coalesce(jsonb_agg(jsonb_build_object(
      'group',pool_group,'required',minimum,'available',available
    )) filter(where available<minimum),'[]'::jsonb)
  ) from groups
$$;
revoke all on function public.outlier_launch_readiness()
  from public,anon,authenticated;
grant execute on function public.outlier_launch_readiness() to service_role;

create or replace function public.outlier_beta_metrics()
returns jsonb language sql stable security definer
set search_path=public,private,pg_temp as $$
 with today as (select (clock_timestamp() at time zone 'UTC')::date as d),
 attempts as (
   select user_id,game_day,completed_at
   from public.game_attempts where mode='daily'
 ), first_days as (
   select user_id,min(game_day) as first_day from attempts
   where completed_at is not null group by user_id
 ), one_day as (
   select f.user_id,f.first_day,
     exists(select 1 from attempts a where a.user_id=f.user_id
       and a.completed_at is not null and a.game_day=f.first_day+1) as returned
   from first_days f cross join today t where f.first_day<=t.d-1
 ), seven_day as (
   select f.user_id,f.first_day,
     exists(select 1 from attempts a where a.user_id=f.user_id
       and a.completed_at is not null and a.game_day=f.first_day+7) as returned
   from first_days f cross join today t where f.first_day<=t.d-7
 )
 select jsonb_build_object(
   'uniquePlayers',(select count(*) from first_days),
   'dailyAttempts',(select count(*) from attempts),
   'completedDailies',(select count(*) from attempts where completed_at is not null),
   'completionPercent',(select coalesce(round(100.0*count(*) filter(where completed_at is not null)/
       nullif(count(*),0),1),0) from attempts),
   'day1Eligible',(select count(*) from one_day),
   'day1Retained',(select count(*) from one_day where returned),
   'day1Percent',(select round(100.0*count(*) filter(where returned)/nullif(count(*),0),1) from one_day),
   'day7Eligible',(select count(*) from seven_day),
   'day7Retained',(select count(*) from seven_day where returned),
   'day7Percent',(select round(100.0*count(*) filter(where returned)/nullif(count(*),0),1) from seven_day)
 )
$$;
revoke all on function public.outlier_beta_metrics() from public,anon,authenticated;
grant execute on function public.outlier_beta_metrics() to service_role;
