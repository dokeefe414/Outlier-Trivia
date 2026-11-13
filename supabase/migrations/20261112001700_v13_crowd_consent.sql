-- OUTLIER v1.3: opt-in, privacy-suppressed historical Fit In response research.
-- This changes NO published scoring and exposes NO answers to unplayed games.
-- Opting out removes all past games from future aggregates immediately.
alter table public.profiles add column if not exists crowd_opted_at timestamptz;

create or replace function public.outlier_crowd_consent(p_user uuid,p_enabled boolean)
returns boolean language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare v_at timestamptz;
begin
  update public.profiles set
    crowd_opted_at=case when p_enabled then coalesce(crowd_opted_at,clock_timestamp()) else null end
  where user_id=p_user
  returning crowd_opted_at into v_at;
  if not found then raise exception 'profile_not_found'; end if;
  return v_at is not null;
end $$;
revoke all on function public.outlier_crowd_consent(uuid,boolean) from public,anon,authenticated;
grant execute on function public.outlier_crowd_consent(uuid,boolean) to service_role;

create or replace function public.outlier_crowd_pulse(p_user uuid,p_question text)
returns jsonb language plpgsql stable security definer
set search_path=public,private,pg_temp as $$
declare v_total integer; v_answers jsonb;
begin
  -- A player can only inspect a question after THEY have finished a
  -- verified official daily in which that exact Fit In question appeared.
  if p_question is null or length(p_question) not between 1 and 110
    or not exists (
      select 1 from public.game_attempts g
      cross join lateral jsonb_array_elements(g.answers) a(value)
      where g.user_id=p_user and g.mode='daily'
        and g.completed_at is not null
        and a.value->>'type'='fit'
        and a.value->>'questionId'=p_question
    ) then
    return jsonb_build_object('available',false,'reason','not_your_completed_question');
  end if;

  -- Only recorded official Fit In picks AFTER opt-in, prior UTC days.
  -- A withdrawal immediately makes all of a player's responses ineligible.
  with responses as (
    select a.value->>'accepted' as answer
    from public.game_attempts g
    join public.profiles p on p.user_id=g.user_id
    cross join lateral jsonb_array_elements(g.answers) a(value)
    where g.mode='daily' and g.completed_at is not null
      and g.game_day<(clock_timestamp() at time zone 'UTC')::date
      and p.crowd_opted_at is not null
      and g.completed_at >= p.crowd_opted_at
      and a.value->>'questionId'=p_question
      and a.value->>'type'='fit'
      and nullif(a.value->>'accepted','') is not null
  ) select count(*)::integer into v_total from responses;
  if v_total<30 then
    return jsonb_build_object('available',false,'reason','below_privacy_threshold','minimum',30);
  end if;

  with responses as (
    select a.value->>'accepted' as answer
    from public.game_attempts g
    join public.profiles p on p.user_id=g.user_id
    cross join lateral jsonb_array_elements(g.answers) a(value)
    where g.mode='daily' and g.completed_at is not null
      and g.game_day<(clock_timestamp() at time zone 'UTC')::date
      and p.crowd_opted_at is not null
      and g.completed_at >= p.crowd_opted_at
      and a.value->>'questionId'=p_question
      and a.value->>'type'='fit'
      and nullif(a.value->>'accepted','') is not null
  ), counts as (
    select answer,count(*)::integer as picks
    from responses group by answer
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'name',answer,'picks',picks,
    'percent',round(picks::numeric*100/v_total,1)
  ) order by picks desc,answer),'[]'::jsonb) into v_answers from counts;

  return jsonb_build_object(
    'available',true,'sampleSize',v_total,'minimum',30,
    'answers',v_answers,
    'note','Opt-in players, previous completed official days only. Not a population survey; never changes frozen points.'
  );
end $$;
revoke all on function public.outlier_crowd_pulse(uuid,text) from public,anon,authenticated;
grant execute on function public.outlier_crowd_pulse(uuid,text) to service_role;
