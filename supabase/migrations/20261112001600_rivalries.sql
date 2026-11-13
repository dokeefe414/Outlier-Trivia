-- OUTLIER v1.1: member-only, consent-based daily friend rivalries.
-- Only mutually COMPLETED, server-scored official daily games are compared.
-- No raw guesses, correct answers, payment status, or private reviews returned.
create or replace function public.outlier_rivalry(
  p_user uuid,p_league uuid,p_opponent uuid,p_days integer default 14
) returns jsonb language plpgsql stable security definer
set search_path=public,private,pg_temp as $$
declare v_result jsonb;v_name text;
begin
  if p_user=p_opponent or p_days not between 7 and 28 then
    raise exception 'invalid_rivalry_request';
  end if;
  if not exists(select 1 from public.friend_league_members
      where league_id=p_league and user_id=p_user)
    or not exists(select 1 from public.friend_league_members
      where league_id=p_league and user_id=p_opponent) then
    raise exception 'not_a_league_member';
  end if;
  select display_name into v_name from public.profiles
    where user_id=p_opponent;
  with matched as (
    select a.game_day,a.score::int as you_score,b.score::int as rival_score
    from public.game_attempts a
    join public.game_attempts b on b.game_day=a.game_day
       and b.user_id=p_opponent and b.mode='daily'
       and b.completed_at is not null
    where a.user_id=p_user and a.mode='daily'
      and a.completed_at is not null
      and a.game_day>=(clock_timestamp() at time zone 'UTC')::date-(p_days-1)
      and a.game_day<=(clock_timestamp() at time zone 'UTC')::date
  ), dated as (
    select game_day,you_score,rival_score,
      case when you_score>rival_score then 'you'
           when you_score<rival_score then 'rival' else 'tie' end as winner
    from matched
  ), recent as (
    select *,row_number() over(order by game_day desc)::int as rownum
    from dated
  ), totals as (
    select count(*)::int as together,
      count(*) filter(where winner='you')::int as you_wins,
      count(*) filter(where winner='rival')::int as rival_wins,
      count(*) filter(where winner='tie')::int as ties,
      coalesce(sum(you_score),0)::bigint as your_points,
      coalesce(sum(rival_score),0)::bigint as rival_points
    from dated
  ), streak as (
    select coalesce(count(*) filter(where r.winner='you' and
      not exists(select 1 from recent prior
        where prior.rownum<r.rownum and prior.winner<>'you')),0)::int as wins_in_row
    from recent r
  )
  select jsonb_build_object(
    'opponentId',p_opponent,'opponentName',coalesce(v_name,'Rival'),
    'windowDays',p_days,'matchedDays',t.together,
    'yourWins',t.you_wins,'opponentWins',t.rival_wins,'ties',t.ties,
    'yourPoints',t.your_points,'opponentPoints',t.rival_points,
    'currentWinStreak',st.wins_in_row,
    'days',coalesce((select jsonb_agg(jsonb_build_object(
      'day',d.game_day,'you',d.you_score,'opponent',d.rival_score,
      'winner',d.winner) order by d.game_day desc) from dated d),'[]'::jsonb),
    'note','Only days both players completed an official daily are included.'
  ) into v_result
  from totals t cross join streak st;
  return v_result;
end $$;
revoke all on function public.outlier_rivalry(uuid,uuid,uuid,integer)
  from public,anon,authenticated;
grant execute on function public.outlier_rivalry(uuid,uuid,uuid,integer)
  to service_role;
