-- OUTLIER hosted mode, v0.3
-- Run via Supabase migrations (never in the browser).
-- All answer keys, purchase records and ranked writes are server-owned.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.question_bank (
  id text primary key,
  kind text not null check (kind in ('rare','fit')),
  category text not null,
  prompt text not null,
  detail text not null default '',
  answers jsonb not null default '[]'::jsonb,
  choices jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
revoke all on private.question_bank from public, anon, authenticated;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Player'
    check (char_length(display_name) between 2 and 24),
  created_at timestamptz not null default now()
);
create or replace function public.create_outlier_profile()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles(user_id,display_name)
  values (new.id, 'Player-' || left(replace(new.id::text,'-',''),6))
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists outlier_profile_created on auth.users;
create trigger outlier_profile_created after insert on auth.users
for each row execute function public.create_outlier_profile();
insert into public.profiles(user_id,display_name)
select id, 'Player-' || left(replace(id::text,'-',''),6) from auth.users
on conflict (user_id) do nothing;

create table if not exists public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  unlimited boolean not null default false,
  stripe_session_id text unique,
  purchased_at timestamptz
);
create table if not exists public.game_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('daily','practice')),
  game_day date,
  question_ids text[] not null check (array_length(question_ids,1) = 7),
  answers jsonb not null default '[]'::jsonb,
  next_index integer not null default 0 check (next_index between 0 and 7),
  score integer not null default 0 check (score between 0 and 7000),
  started_at timestamptz not null default now(),
  question_started_at timestamptz,
  completed_at timestamptz,
  check ((mode='daily' and game_day is not null) or (mode='practice' and game_day is null))
);
create unique index if not exists one_daily_attempt_per_player
  on public.game_attempts(user_id,game_day) where mode='daily';
create index if not exists leaderboard_daily_idx
  on public.game_attempts(game_day,score desc) where mode='daily' and completed_at is not null;
create index if not exists player_attempts_idx
  on public.game_attempts(user_id,completed_at desc);

-- RLS prevents direct browser writes; only the Edge Function service role can
-- call the guarded RPCs below. Browsers get no raw question keys or attempt rows.
alter table public.profiles enable row level security;
alter table public.entitlements enable row level security;
alter table public.game_attempts enable row level security;
revoke all on public.profiles,public.entitlements,public.game_attempts from anon, authenticated;
grant usage on schema public to anon,authenticated;

create or replace function private.normalized_answer(p_text text)
returns text language sql immutable strict as $$
  select regexp_replace(lower(p_text),'[^a-z0-9]','','g')
$$;

-- These functions run with elevated permissions, but their EXECUTE privilege
-- is granted ONLY to service_role. Every user ID is supplied by the Edge Function
-- after verifying the Supabase-issued access token using /auth/v1/user.
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
begin
  if p_mode not in ('daily','practice') then raise exception 'invalid_game_mode'; end if;
  if p_mode='daily' then
    select id into v_game from public.game_attempts
    where user_id=p_user and mode='daily' and game_day=v_day limit 1;
    if found then return v_game; end if;
    v_salt := 'outlier-online-week-v1:' || v_week::text;
    with rarer as (
      select id,row_number() over(order by md5(v_salt || id)) as rank
      from private.question_bank where kind='rare'
    ), fitting as (
      select id,row_number() over(order by md5(v_salt || id)) as rank
      from private.question_bank where kind='fit'
    )
    select array[
      (select id from rarer where rank=v_day_index*4+1),
      (select id from fitting where rank=v_day_index*3+1),
      (select id from rarer where rank=v_day_index*4+2),
      (select id from fitting where rank=v_day_index*3+2),
      (select id from rarer where rank=v_day_index*4+3),
      (select id from fitting where rank=v_day_index*3+3),
      (select id from rarer where rank=v_day_index*4+4)
    ] into v_ids;
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
  with r as (select id,row_number() over(order by random()) n from private.question_bank where kind='rare'),
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

create or replace function public.outlier_state(p_user uuid, p_game uuid)
returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_game public.game_attempts%rowtype;
  v_q private.question_bank%rowtype;
  v_options jsonb;
  v_current jsonb;
begin
  select * into v_game from public.game_attempts where id=p_game and user_id=p_user;
  if not found then raise exception 'game_not_found'; end if;
  if v_game.next_index < 7 then
    select * into v_q from private.question_bank where id=v_game.question_ids[v_game.next_index+1];
    if not found then raise exception 'question_not_found'; end if;
    if v_q.kind='fit' then
      select coalesce(jsonb_agg(value->>0 order by md5(value->>0 || v_game.id::text)),'[]'::jsonb)
      into v_options from jsonb_array_elements(v_q.choices);
    else v_options := null; end if;
    v_current := jsonb_build_object('id',v_q.id,'type',v_q.kind,'category',v_q.category,
      'prompt',v_q.prompt,'detail',v_q.detail,'choices',v_options,
      'deadline',case when v_game.question_started_at is null then null
        else v_game.question_started_at + interval '45 seconds' end);
  end if;
  return jsonb_build_object('id',v_game.id,'mode',v_game.mode,'day',v_game.game_day,
    'index',v_game.next_index,'score',v_game.score,'answers',v_game.answers,
    'complete',v_game.completed_at is not null,'question',v_current);
end $$;

create or replace function public.outlier_answer(
  p_user uuid, p_game uuid, p_index integer, p_response text default null
) returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_game public.game_attempts%rowtype;
  v_q private.question_bank%rowtype;
  v_row jsonb;
  v_alias jsonb;
  v_label text := null;
  v_points integer := 0;
  v_share integer := null;
  v_max integer := 0;
  v_correct boolean := false;
  v_text text := left(coalesce(p_response,''),100);
  v_norm text := private.normalized_answer(left(coalesce(p_response,''),100));
  v_result jsonb;
  v_reveal jsonb;
  v_now timestamptz := clock_timestamp();
begin
  select * into v_game from public.game_attempts where id=p_game and user_id=p_user for update;
  if not found then raise exception 'game_not_found'; end if;
  if v_game.completed_at is not null then raise exception 'game_already_finished'; end if;
  if v_game.next_index <> p_index then raise exception 'incorrect_question_index'; end if;
  if p_index not between 0 and 6 then raise exception 'invalid_question_index'; end if;
  if v_game.question_started_at is null then raise exception 'question_not_started'; end if;
  select * into v_q from private.question_bank where id=v_game.question_ids[p_index+1];
  if not found then raise exception 'question_not_found'; end if;

  -- The client cannot award extra points or extend a timer.
  if v_now <= v_game.question_started_at + interval '45 seconds' and length(v_norm)>0 then
    if v_q.kind='rare' then
      for v_row in select value from jsonb_array_elements(v_q.answers) loop
        if private.normalized_answer(v_row->>0) = v_norm then
          v_label := v_row->>0; v_points := (v_row->>1)::int; exit;
        end if;
        if jsonb_typeof(v_row->2)='array' then
          for v_alias in select value from jsonb_array_elements(v_row->2) loop
            if private.normalized_answer(v_alias #>> '{}') = v_norm then
              v_label := v_row->>0; v_points := (v_row->>1)::int; exit;
            end if;
          end loop;
        end if;
        if v_label is not null then exit; end if;
      end loop;
    else
      select max((value->>1)::int) into v_max from jsonb_array_elements(v_q.choices);
      for v_row in select value from jsonb_array_elements(v_q.choices) loop
        if private.normalized_answer(v_row->>0)=v_norm then
          v_label := v_row->>0;
          v_share := (v_row->>1)::int;
          v_points := round(v_share::numeric / greatest(v_max,1) * 1000)::int;
          exit;
        end if;
      end loop;
    end if;
  end if;
  v_correct := v_label is not null;
  v_result := jsonb_build_object('questionId',v_q.id,'type',v_q.kind,'category',v_q.category,
    'accepted',v_label,'points',v_points,'share',v_share,'valid',v_correct);
  if v_q.kind='fit' then
    select jsonb_agg(jsonb_build_object('name',value->>0,'share',(value->>1)::int)
      order by (value->>1)::int desc) into v_reveal
    from jsonb_array_elements(v_q.choices);
  else
    select jsonb_agg(jsonb_build_object('name',name,'points',points)
      order by points desc) into v_reveal
    from (select value->>0 as name,(value->>1)::int as points
      from jsonb_array_elements(v_q.answers) order by points desc limit 4) top;
  end if;
  update public.game_attempts set
    answers = v_game.answers || jsonb_build_array(v_result),
    score = v_game.score + v_points,
    next_index = v_game.next_index + 1,
    question_started_at = null,
    completed_at = case when p_index=6 then clock_timestamp() else null end
  where id=p_game;
  return jsonb_build_object('feedback',v_result,'reveal',v_reveal,'state',public.outlier_state(p_user,p_game));
end $$;


-- The reveal screen does not consume time from the next round.
-- This guarded transition is idempotent: repeated clicks cannot restart the clock.
create or replace function public.outlier_advance(
  p_user uuid, p_game uuid, p_index integer
) returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare v_game public.game_attempts%rowtype;
begin
  select * into v_game from public.game_attempts where id=p_game and user_id=p_user for update;
  if not found then raise exception 'game_not_found'; end if;
  if v_game.completed_at is not null then return public.outlier_state(p_user,p_game); end if;
  if p_index <> v_game.next_index or p_index not between 1 and 6 then raise exception 'incorrect_question_index'; end if;
  if v_game.question_started_at is null then
    update public.game_attempts set question_started_at=clock_timestamp() where id=p_game;
  end if;
  return public.outlier_state(p_user,p_game);
end $$;

create or replace function public.outlier_leaderboard(
  p_board text default 'daily', p_limit integer default 50
) returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare v_result jsonb;
begin
  if p_board not in ('daily','average','total') then raise exception 'invalid_board'; end if;
  with grouped as (
    select g.user_id,count(*)::integer as days,
      sum(g.score)::bigint as total_points,
      round(avg(g.score))::integer as avg_points,
      max(g.score) filter(where game_day=(clock_timestamp() at time zone 'UTC')::date)::integer as today_points
    from public.game_attempts g
    where g.mode='daily' and g.completed_at is not null group by g.user_id
  ), eligible as (
    select grouped.*,case p_board
      when 'daily' then today_points
      when 'average' then avg_points
      else total_points end as board_score,
      p.display_name
    from grouped join public.profiles p on p.user_id=grouped.user_id
    where (p_board <> 'daily' or today_points is not null)
      and (p_board <> 'average' or days >= 10)
  ), ranked as (
    select row_number() over(order by board_score desc,days desc,user_id)::integer as position,
      display_name,board_score,days,user_id from eligible
  )
  select coalesce(jsonb_agg(jsonb_build_object('position',position,'name',display_name,
     'score',board_score,'days',days,'userId',user_id) order by position),'[]'::jsonb)
  into v_result from (select * from ranked order by position limit least(greatest(p_limit,1),100)) results;
  return v_result;
end $$;

create or replace function public.outlier_player_stats(p_user uuid)
returns jsonb language sql stable security definer
set search_path = public, private, pg_temp as $$
  select jsonb_build_object(
    'days', count(*)::int, 'total', coalesce(sum(score),0)::bigint,
    'average',coalesce(round(avg(score)),0)::int,'best',coalesce(max(score),0)::int
  ) from public.game_attempts
  where user_id=p_user and mode='daily' and completed_at is not null
$$;

-- Only the verified Edge Function (service_role) may call privileged RPCs.
revoke all on function public.create_outlier_profile() from public,anon,authenticated;
revoke all on function public.outlier_start(uuid,text) from public,anon,authenticated;
revoke all on function public.outlier_state(uuid,uuid) from public,anon,authenticated;
revoke all on function public.outlier_answer(uuid,uuid,integer,text) from public,anon,authenticated;
revoke all on function public.outlier_advance(uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.outlier_leaderboard(text,integer) from public,anon,authenticated;
revoke all on function public.outlier_player_stats(uuid) from public,anon,authenticated;
grant execute on function public.outlier_start(uuid,text) to service_role;
grant execute on function public.outlier_state(uuid,uuid) to service_role;
grant execute on function public.outlier_answer(uuid,uuid,integer,text) to service_role;
grant execute on function public.outlier_advance(uuid,uuid,integer) to service_role;
grant execute on function public.outlier_leaderboard(text,integer) to service_role;
grant execute on function public.outlier_player_stats(uuid) to service_role;
