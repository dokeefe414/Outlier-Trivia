-- OUTLIER v0.5 release: category-balanced diverse daily rounds and full-content practice.
-- Existing authenticated daily attempts keep the exact question_ids stored at start.
-- Old v0.4 daily schedule stays on 2026-11-12; new rotation starts 2026-11-13.
-- Each daily game retains 4 rare and 3 Fit In, with a deterministic weekly rotation.
create or replace function public.outlier_start(p_user uuid, p_mode text)
returns uuid language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_day date := (clock_timestamp() at time zone 'UTC')::date;
  v_week date := v_day - (extract(isodow from v_day)::int - 1);
  v_day_index integer := extract(isodow from v_day)::int - 1;
  v_ids text[];
  v_game uuid;
  v_salt text;
  v_entitled boolean;
  v_schedule text[][] := array[
    array['geo','movies','animals','sports'],
    array['science','tv','music','food'],
    array['wild','games','history','people'],
    array['geo','movies','music','animals'],
    array['science','tv','sports','games'],
    array['wild','food','people','history'],
    array['geo','music','sports','animals']
  ];
  v_k integer;
  v_rank integer;
  v_group text;
  v_selected text;
  v_rare text[] := array[]::text[];
  v_fit text[] := array[]::text[];

begin
  if p_mode not in ('daily','practice') then raise exception 'invalid_game_mode'; end if;
  if p_mode='daily' then
    select id into v_game from public.game_attempts
    where user_id=p_user and mode='daily' and game_day=v_day limit 1;
    if found then return v_game; end if;
    if v_day < date '2026-11-13' then
      -- Respect the v0.4 launch day's question set.
      v_salt := 'outlier-online-atlas-v1:' || v_week::text;
      with geos as (
        select id,row_number() over(order by md5(v_salt || id)) as rank
        from private.question_bank where id like 'atlas-geo-%'
      ), sciences as (
        select id,row_number() over(order by md5(v_salt || id)) as rank
        from private.question_bank where id like 'atlas-science-%'
      ), wilds as (
        select id,row_number() over(order by md5(v_salt || id)) as rank
        from private.question_bank where id like 'atlas-wild-%'
      ), fitting as (
        select id,row_number() over(order by md5(v_salt || id)) as rank
        from private.question_bank where kind='fit'
      )
      select array[
        (select id from geos where rank=v_day_index*2+1),
        (select id from fitting where rank=v_day_index*3+1),
        (select id from sciences where rank=v_day_index+1),
        (select id from fitting where rank=v_day_index*3+2),
        (select id from geos where rank=v_day_index*2+2),
        (select id from fitting where rank=v_day_index*3+3),
        (select id from wilds where rank=v_day_index+1)
      ] into v_ids;
    else
      -- Category-rotating schedule: no duplicate prompt within the UTC week.
      v_salt := 'outlier-online-content-v1:' || v_week::text;
      for v_k in 1..4 loop
        v_group := v_schedule[v_day_index+1][v_k];
        select count(*)::int into v_rank
          from generate_series(0,v_day_index) d
          cross join generate_series(1,4) slot
          where (d<v_day_index or slot < v_k)
            and v_schedule[d+1][slot] = v_group;
        select id into v_selected from private.question_bank
          where (v_group in ('geo','science','wild') and id like 'atlas-'||v_group||'-%')
             or id like 'pack-'||v_group||'-%'
          order by md5(v_salt || id) offset v_rank limit 1;
        if v_selected is null then raise exception 'question_bank_too_small'; end if;
        v_rare[v_k] := v_selected;
      end loop;
      with f as (
        select id,row_number() over(order by md5(v_salt || id)) as rank
        from private.question_bank where kind='fit'
      )
      select array[
        (select id from f where rank=v_day_index*3+1),
        (select id from f where rank=v_day_index*3+2),
        (select id from f where rank=v_day_index*3+3)
      ] into v_fit;
      v_ids := array[v_rare[1],v_fit[1],v_rare[2],v_fit[2],
                      v_rare[3],v_fit[3],v_rare[4]];
    end if;
    if array_position(v_ids,null) is not null then raise exception 'question_bank_too_small'; end if;
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
  -- Use one random sort per mode to guarantee no duplicate prompts.
  with r as (select id,row_number() over(order by random()) n from private.question_bank where id like 'atlas-%' or id like 'pack-%'),
       f as (select id,row_number() over(order by random()) n from private.question_bank where kind='fit')
  select array[(select id from r where n=1),(select id from f where n=1),
               (select id from r where n=2),(select id from f where n=2),
               (select id from r where n=3),(select id from f where n=3),
               (select id from r where n=4)] into v_ids;
  if array_position(v_ids,null) is not null then raise exception 'question_bank_too_small'; end if;
  insert into public.game_attempts(user_id,mode,question_ids,question_started_at)
  values(p_user,'practice',v_ids,clock_timestamp()) returning id into v_game;
  return v_game;
end $$;
