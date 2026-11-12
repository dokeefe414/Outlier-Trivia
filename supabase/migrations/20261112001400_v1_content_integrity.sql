-- OUTLIER v1.0 — ranked game preflight is stricter than mere row counts.
-- This check intentionally exposes only counts, never answers or prompt IDs.
create or replace function private.outlier_ranked_row_valid(
  p_kind text,p_answers jsonb,p_choices jsonb
) returns boolean language plpgsql immutable
set search_path=private,pg_temp as $$
declare
  v_row jsonb;
  v_alias jsonb;
  v_key text;
  v_owner text;
  v_seen jsonb := '{}'::jsonb;
  v_sum integer := 0;
  v_points integer;
begin
  if p_kind='rare' then
    if p_answers is null or jsonb_typeof(p_answers)<>'array'
       or jsonb_array_length(p_answers)<20 then return false; end if;
    if p_choices is null or jsonb_typeof(p_choices)<>'array'
       or jsonb_array_length(p_choices)<>0 then return false; end if;
    for v_row in select value from jsonb_array_elements(p_answers) loop
      if jsonb_typeof(v_row)<>'array' or jsonb_array_length(v_row) not between 2 and 3
         or jsonb_typeof(v_row->0)<>'string'
         or length(trim(v_row->>0)) not between 1 and 100
         or jsonb_typeof(v_row->1)<>'number'
         or (v_row->>1)!~ '^[0-9]+$' then return false; end if;
      v_points:=(v_row->>1)::integer;
      if v_points not between 1 and 1000 then return false; end if;
      v_owner:=private.normalized_answer(v_row->>0);
      if v_owner='' or length(v_owner)<1 then return false; end if;
      if v_seen ? v_owner then return false; end if;
      v_seen:=jsonb_set(v_seen,array[v_owner],to_jsonb(v_owner),true);
      if jsonb_array_length(v_row)=3 then
        if jsonb_typeof(v_row->2)<>'array' then return false; end if;
        for v_alias in select value from jsonb_array_elements(v_row->2) loop
          if jsonb_typeof(v_alias)<>'string' then return false; end if;
          v_key:=private.normalized_answer(v_alias #>> '{}');
          if v_key='' or length(v_key)<1 then return false; end if;
          -- Aliases for different entities may never collapse to one key.
          if v_seen ? v_key and v_seen->>v_key<>v_owner then return false; end if;
          v_seen:=jsonb_set(v_seen,array[v_key],to_jsonb(v_owner),true);
        end loop;
      end if;
    end loop;
    return true;
  elsif p_kind='fit' then
    if p_choices is null or jsonb_typeof(p_choices)<>'array'
       or jsonb_array_length(p_choices)<>6 then return false; end if;
    if p_answers is null or jsonb_typeof(p_answers)<>'array'
       or jsonb_array_length(p_answers)<>0 then return false; end if;
    for v_row in select value from jsonb_array_elements(p_choices) loop
      if jsonb_typeof(v_row)<>'array' or jsonb_array_length(v_row)<>2
         or jsonb_typeof(v_row->0)<>'string'
         or length(trim(v_row->>0)) not between 1 and 100
         or jsonb_typeof(v_row->1)<>'number'
         or (v_row->>1)!~ '^[0-9]+$' then return false; end if;
      v_key:=private.normalized_answer(v_row->>0);
      if v_key='' or v_seen ? v_key then return false; end if;
      v_seen:=jsonb_set(v_seen,array[v_key],to_jsonb(true),true);
      v_points:=(v_row->>1)::integer;
      if v_points not between 0 and 100 then return false; end if;
      v_sum:=v_sum+v_points;
    end loop;
    return v_sum=100;
  end if;
  return false;
exception when numeric_value_out_of_range then
  return false;
end $$;
revoke all on function private.outlier_ranked_row_valid(text,jsonb,jsonb)
  from public,anon,authenticated;

create or replace function public.outlier_launch_readiness()
returns jsonb language sql stable security definer
set search_path=public,private,pg_temp as $$
  with required(pool_group,minimum) as (
    values ('geo',3),('science',2),('wild',2),('movies',2),
      ('tv',2),('music',3),('sports',3),('animals',3),
      ('food',2),('games',2),('history',2),('people',2),('fit',21)
  ), eligible as (
    select id,pool_group,
      private.outlier_ranked_row_valid(kind,answers,choices) as valid
    from private.ranked_question_bank
  ), groups as (
    select r.pool_group,r.minimum,
      count(q.id)::int as available,
      count(q.id) filter(where q.valid)::int as eligible
    from required r left join eligible q on q.pool_group=r.pool_group
    group by r.pool_group,r.minimum
  )
  select jsonb_build_object(
    'ready',coalesce(bool_and(eligible>=minimum),false)
       and (select count(*) from eligible where not valid)=0,
    'privateQuestions',coalesce(sum(available),0),
    'verifiedQuestions',coalesce(sum(eligible),0),
    'invalidQuestions',(select count(*) from eligible where not valid),
    'missing',coalesce(jsonb_agg(jsonb_build_object(
       'group',pool_group,'required',minimum,'available',eligible
    )) filter(where eligible<minimum),'[]'::jsonb)
  ) from groups
$$;
revoke all on function public.outlier_launch_readiness()
  from public,anon,authenticated;
grant execute on function public.outlier_launch_readiness() to service_role;

create or replace function public.outlier_start(p_user uuid, p_mode text)
returns uuid language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare
  v_day date := (clock_timestamp() at time zone 'UTC')::date;
  v_ids text[];
  v_game uuid;
  v_entitled boolean;
  v_offset integer;
  v_publish_day date;
  v_publish_ids text[];
begin
  if p_mode not in ('daily','practice') then raise exception 'invalid_game_mode'; end if;
  -- A database populated with malformed or publicly seeded placeholders must
  -- not become ranked solely because every category has enough rows.
  if coalesce((public.outlier_launch_readiness()->>'ready')::boolean,false)=false then
    raise exception 'private_question_bank_not_configured';
  end if;
  if p_mode='daily' then
    select id into v_game from public.game_attempts
      where user_id=p_user and mode='daily' and game_day=v_day limit 1;
    if found then return v_game; end if;
    -- Seal ALL seven UTC days together under a week lock, so adding
    -- content midweek cannot change a future day or repeat an earlier prompt.
    perform pg_advisory_xact_lock(hashtext('outlier-week:'||
      (v_day-(extract(isodow from v_day)::int-1))::text));
    select question_ids into v_ids from private.official_daily_slates
      where game_day=v_day;
    if not found then
      for v_offset in 0..6 loop
        v_publish_day:=v_day-(extract(isodow from v_day)::int-1)+v_offset;
        if not exists(select 1 from private.official_daily_slates
            where game_day=v_publish_day) then
          v_publish_ids:=private.outlier_preview_daily_ids(v_publish_day);
          insert into private.official_daily_slates(game_day,question_ids)
            values(v_publish_day,v_publish_ids) on conflict do nothing;
        end if;
      end loop;
      select question_ids into v_ids from private.official_daily_slates
        where game_day=v_day;
    end if;
    insert into public.game_attempts(user_id,mode,game_day,question_ids,question_started_at)
      values(p_user,'daily',v_day,v_ids,clock_timestamp())
      on conflict do nothing returning id into v_game;
    if v_game is null then
      select id into v_game from public.game_attempts
      where user_id=p_user and mode='daily' and game_day=v_day;
    end if;
    return v_game;
  end if;
  select unlimited into v_entitled from public.entitlements where user_id=p_user;
  if not coalesce(v_entitled,false) then raise exception 'payment_required'; end if;
  with rare as (
    select id,row_number() over(order by random()) rn
    from private.ranked_question_bank where kind='rare'
  ), fit as (
    select id,row_number() over(order by random()) rn
    from private.ranked_question_bank where kind='fit'
  )
  select array[
    (select id from rare where rn=1),(select id from fit where rn=1),
    (select id from rare where rn=2),(select id from fit where rn=2),
    (select id from rare where rn=3),(select id from fit where rn=3),
    (select id from rare where rn=4)
  ] into v_ids;
  if array_position(v_ids,null) is not null then raise exception 'private_question_bank_not_configured'; end if;
  insert into public.game_attempts(user_id,mode,question_ids,question_started_at)
    values(p_user,'practice',v_ids,clock_timestamp()) returning id into v_game;
  return v_game;
end $$;
revoke all on function public.outlier_start(uuid,text)
  from public,anon,authenticated;
grant execute on function public.outlier_start(uuid,text) to service_role;
