-- OUTLIER v0.7 ranked security boundary.
-- This table is intentionally EMPTY in public repository migrations.
-- Ranked question answers and accepted aliases MUST be privately curated
-- and imported into the owner-controlled database, never committed to GitHub.
create table if not exists private.ranked_question_bank (
  id text primary key check (char_length(id) between 10 and 100),
  kind text not null check (kind in ('rare','fit')),
  pool_group text not null check (pool_group in
    ('geo','science','wild','movies','tv','music','sports','animals',
     'food','games','history','people','fit')),
  category text not null,
  prompt text not null,
  detail text not null default '',
  answers jsonb not null default '[]'::jsonb check (jsonb_typeof(answers)='array'),
  choices jsonb not null default '[]'::jsonb check (jsonb_typeof(choices)='array'),
  created_at timestamptz not null default now(),
  check ((kind='rare' and pool_group<>'fit' and jsonb_array_length(answers)>=1)
     or (kind='fit' and pool_group='fit' and jsonb_array_length(choices)=6))
);
revoke all on private.ranked_question_bank from public,anon,authenticated;
create index if not exists ranked_bank_group_idx on private.ranked_question_bank(pool_group,id);

-- Freeze the actual seven questions for a day on the first ranked start.
-- Adding unrelated content later cannot re-deal the day's official slate.
create table if not exists private.official_daily_slates (
  game_day date primary key,
  question_ids text[] not null check (array_length(question_ids,1)=7),
  sealed_at timestamptz not null default clock_timestamp()
);
revoke all on private.official_daily_slates from public,anon,authenticated;

-- A question that has been in an official slate is immutable forever.
-- Fix a mistaken key by versioning a new question ID for future weeks.
create or replace function private.prevent_published_answer_edits()
returns trigger language plpgsql security definer
set search_path=private,public,pg_temp as $
begin
  if exists(select 1 from private.official_daily_slates
      where old.id=any(question_ids)) then
    raise exception 'published_question_is_immutable';
  end if;
  return old;
end $;
drop trigger if exists ranked_question_immutable on private.ranked_question_bank;
create trigger ranked_question_immutable before update or delete
on private.ranked_question_bank for each row
execute function private.prevent_published_answer_edits();
revoke all on function private.prevent_published_answer_edits() from public,anon,authenticated;


-- The private, immutable UTC day/week schedule. Only answer IDs are stored
-- in game_attempts and no client receives future-day prompts or score keys.
create or replace function private.outlier_preview_daily_ids(p_day date)
returns text[] language plpgsql stable security definer
set search_path=private,public,pg_temp as $$
declare
  v_week date := p_day - (extract(isodow from p_day)::int - 1);
  v_day_index integer := extract(isodow from p_day)::int - 1;
  v_salt text := 'outlier-v07-private-week:' || v_week::text;
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
  v_ids text[];
begin
  for v_k in 1..4 loop
    v_group:=v_schedule[v_day_index+1][v_k];
    select count(*)::int into v_rank
    from generate_series(0,v_day_index) d
    cross join generate_series(1,4) slot
    where (d<v_day_index or slot<v_k)
      and v_schedule[d+1][slot]=v_group;
    select q.id into v_selected
      from private.ranked_question_bank q
      where q.kind='rare' and q.pool_group=v_group
      order by md5(v_salt||q.id)
      offset v_rank limit 1;
    if v_selected is null then raise exception 'private_question_bank_not_configured'; end if;
    v_rare[v_k]:=v_selected;
  end loop;
  with fit as (
    select id,row_number() over(order by md5(v_salt||id)) as rn
    from private.ranked_question_bank where kind='fit'
  )
  select array[(select id from fit where rn=v_day_index*3+1),
    (select id from fit where rn=v_day_index*3+2),
    (select id from fit where rn=v_day_index*3+3)] into v_fit;
  v_ids:=array[v_rare[1],v_fit[1],v_rare[2],v_fit[2],v_rare[3],v_fit[3],v_rare[4]];
  if array_position(v_ids,null) is not null then raise exception 'private_question_bank_not_configured'; end if;
  return v_ids;
end $$;
revoke all on function private.outlier_preview_daily_ids(date) from public,anon,authenticated;
grant execute on function private.outlier_preview_daily_ids(date) to service_role;

create or replace function public.outlier_start(p_user uuid, p_mode text)
returns uuid language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare
  v_day date := (clock_timestamp() at time zone 'UTC')::date;
  v_ids text[];
  v_game uuid;
  v_entitled boolean;
begin
  if p_mode not in ('daily','practice') then raise exception 'invalid_game_mode'; end if;
  if p_mode='daily' then
    select id into v_game from public.game_attempts
      where user_id=p_user and mode='daily' and game_day=v_day limit 1;
    if found then return v_game; end if;
    select question_ids into v_ids from private.official_daily_slates
      where game_day=v_day;
    if not found then
      v_ids:=private.outlier_preview_daily_ids(v_day);
      insert into private.official_daily_slates(game_day,question_ids)
        values(v_day,v_ids) on conflict do nothing;
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

create or replace function public.outlier_state(p_user uuid, p_game uuid)
returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_game public.game_attempts%rowtype;
  v_q private.ranked_question_bank%rowtype;
  v_options jsonb;
  v_current jsonb;
begin
  select * into v_game from public.game_attempts where id=p_game and user_id=p_user;
  if not found then raise exception 'game_not_found'; end if;
  if v_game.next_index < 7 then
    select * into v_q from private.ranked_question_bank where id=v_game.question_ids[v_game.next_index+1];
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
  v_q private.ranked_question_bank%rowtype;
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
  v_candidate text := null;
  v_candidate_points integer := 0;
  v_near boolean := false;
  v_alias_text text;
begin
  select * into v_game from public.game_attempts where id=p_game and user_id=p_user for update;
  if not found then raise exception 'game_not_found'; end if;
  if v_game.completed_at is not null then raise exception 'game_already_finished'; end if;
  if v_game.next_index <> p_index then raise exception 'incorrect_question_index'; end if;
  if p_index not between 0 and 6 then raise exception 'invalid_question_index'; end if;
  if v_game.question_started_at is null then raise exception 'question_not_started'; end if;
  select * into v_q from private.ranked_question_bank where id=v_game.question_ids[p_index+1];
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
      -- Match a *single* one-character typo in answers of length 5+.
      -- More than one possible canonical answer means reject ambiguity.
      if v_label is null and length(v_norm)>=5 then
        for v_row in select value from jsonb_array_elements(v_q.answers) loop
          v_near:=private.outlier_one_typo(v_norm,private.normalized_answer(v_row->>0));
          if not v_near and jsonb_typeof(v_row->2)='array' then
            for v_alias in select value from jsonb_array_elements(v_row->2) loop
              v_alias_text:=v_alias #>> '{}';
              if private.outlier_one_typo(v_norm,private.normalized_answer(v_alias_text)) then
                v_near:=true; exit;
              end if;
            end loop;
          end if;
          if v_near then
            if v_candidate is not null and v_candidate<>v_row->>0 then
              v_candidate:=''; exit;
            end if;
            v_candidate:=v_row->>0;
            v_candidate_points:=(v_row->>1)::int;
          end if;
        end loop;
        if v_candidate is not null and v_candidate<>'' then
          v_label:=v_candidate;v_points:=v_candidate_points;
        end if;
      end if;
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
    'accepted',v_label,'response',v_text,'points',v_points,'share',v_share,'valid',v_correct);
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
revoke all on function public.outlier_start(uuid,text) from public,anon,authenticated;
revoke all on function public.outlier_state(uuid,uuid) from public,anon,authenticated;
revoke all on function public.outlier_answer(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.outlier_start(uuid,text) to service_role;
grant execute on function public.outlier_state(uuid,uuid) to service_role;
grant execute on function public.outlier_answer(uuid,uuid,integer,text) to service_role;
