-- OUTLIER v0.6 — friends, verified weekly competition, response research,
-- and authenticated answer review. Only Edge Function service_role may
-- execute these RPCs; browser clients have no table writes.
create table if not exists public.friend_leagues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 40),
  invite_code text not null unique check (invite_code ~ '^[a-f0-9]{12}$'),
  created_at timestamptz not null default now()
);
create table if not exists public.friend_league_members (
  league_id uuid not null references public.friend_leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id,user_id)
);
create index if not exists friend_league_members_player_idx on public.friend_league_members(user_id);
create table if not exists public.answer_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid not null references public.game_attempts(id) on delete cascade,
  question_id text not null,
  submitted_answer text not null check (char_length(submitted_answer) between 1 and 100),
  reason text not null check (char_length(reason) between 12 and 500),
  status text not null default 'pending' check (status in ('pending','approved','rejected','needs_more_info')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (user_id,attempt_id,question_id)
);
create index if not exists answer_reviews_pending_idx on public.answer_reviews(status,created_at);

alter table public.friend_leagues enable row level security;
alter table public.friend_league_members enable row level security;
alter table public.answer_reviews enable row level security;
revoke all on public.friend_leagues,public.friend_league_members,public.answer_reviews from anon,authenticated;
revoke all on public.friend_leagues,public.friend_league_members,public.answer_reviews from public;

create or replace function public.outlier_league_create(p_user uuid,p_title text)
returns jsonb language plpgsql security definer
set search_path = public,private,pg_temp as $$
declare
  v_title text := trim(regexp_replace(left(coalesce(p_title,''),80),'\s+',' ','g'));
  v_id uuid;
  v_code text;
begin
  if char_length(v_title) not between 3 and 40
    or v_title !~ '^[A-Za-z0-9][A-Za-z0-9 ._&-]+$' then
    raise exception 'invalid_league_name';
  end if;
  if (select count(*) from public.friend_leagues where owner_id=p_user)>=3 then
    raise exception 'league_limit_reached';
  end if;
  if (select count(*) from public.friend_league_members where user_id=p_user)>=12 then
    raise exception 'league_membership_limit';
  end if;
  loop
    v_code:=left(replace(gen_random_uuid()::text,'-',''),12);
    begin
      insert into public.friend_leagues(owner_id,title,invite_code)
      values(p_user,v_title,v_code) returning id into v_id;
      exit;
    exception when unique_violation then
      continue;
    end;
  end loop;
  insert into public.friend_league_members(league_id,user_id) values(v_id,p_user);
  return jsonb_build_object('id',v_id,'title',v_title,'code',v_code);
end $$;

create or replace function public.outlier_league_join(p_user uuid,p_code text)
returns jsonb language plpgsql security definer
set search_path = public,private,pg_temp as $$
declare
  v_id uuid;
  v_title text;
  v_code text:=lower(trim(coalesce(p_code,'')));
begin
  if v_code !~ '^[a-f0-9]{12}$' then raise exception 'invalid_invite_code'; end if;
  select id,title into v_id,v_title
  from public.friend_leagues where invite_code=v_code for update;
  if v_id is null then raise exception 'invalid_invite_code'; end if;
  if exists(select 1 from public.friend_league_members where league_id=v_id and user_id=p_user) then
    return jsonb_build_object('id',v_id,'title',v_title,'alreadyMember',true);
  end if;
  if (select count(*) from public.friend_league_members where league_id=v_id)>=50 then
    raise exception 'league_is_full';
  end if;
  if (select count(*) from public.friend_league_members where user_id=p_user)>=12 then
    raise exception 'league_membership_limit';
  end if;
  insert into public.friend_league_members(league_id,user_id) values(v_id,p_user)
    on conflict do nothing;
  return jsonb_build_object('id',v_id,'title',v_title,'alreadyMember',false);
end $$;

create or replace function public.outlier_league_list(p_user uuid)
returns jsonb language sql stable security definer
set search_path=public,private,pg_temp as $$
  select coalesce(jsonb_agg(
    jsonb_build_object('id',l.id,'title',l.title,'code',l.invite_code,
      'members',(select count(*) from public.friend_league_members m2 where m2.league_id=l.id),
      'owner',l.owner_id=p_user)
    order by l.created_at desc
  ),'[]'::jsonb)
  from public.friend_league_members m
  join public.friend_leagues l on l.id=m.league_id
  where m.user_id=p_user
$$;

create or replace function public.outlier_league_standings(p_user uuid,p_league uuid,p_period text default 'week')
returns jsonb language plpgsql stable security definer
set search_path=public,private,pg_temp as $$
declare v_result jsonb;
begin
  if p_period not in ('today','week','all') then raise exception 'invalid_period'; end if;
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
          and g.game_day<date_trunc('week',clock_timestamp() at time zone 'UTC')::date+7))
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

create or replace function public.outlier_weekly_leaderboard(p_limit integer default 50)
returns jsonb language sql stable security definer
set search_path=public,private,pg_temp as $$
  with scores as (
    select g.user_id,sum(g.score)::bigint as score,count(*)::int as days
    from public.game_attempts g where g.mode='daily' and g.completed_at is not null
      and g.game_day>=date_trunc('week',clock_timestamp() at time zone 'UTC')::date
      and g.game_day<date_trunc('week',clock_timestamp() at time zone 'UTC')::date+7
    group by g.user_id
  ), ranked as (
    select row_number() over(order by s.score desc,s.days desc,s.user_id)::int as position,
      s.user_id,s.score,s.days,p.display_name
    from scores s join public.profiles p on p.user_id=s.user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'position',position,'userId',user_id,'name',display_name,
    'score',score,'days',days
  ) order by position),'[]'::jsonb)
  from (select * from ranked order by position limit least(greatest(p_limit,1),100)) t
$$;

create or replace function public.outlier_player_history(p_user uuid,p_limit integer default 35)
returns jsonb language sql stable security definer
set search_path=public,private,pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('day',game_day,'score',score)
    order by game_day desc),'[]'::jsonb)
  from (select game_day,score from public.game_attempts
    where user_id=p_user and mode='daily' and completed_at is not null
    order by game_day desc limit least(greatest(p_limit,1),90)) rows
$$;

-- One review per user, attempt and question; no unsolicited reviews;
-- only a previously scored invalid answer can be reviewed.
create or replace function public.outlier_review_submit(
  p_user uuid,p_attempt uuid,p_question text,p_reason text
) returns jsonb language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare
  v_game public.game_attempts%rowtype;
  v_response jsonb;
  v_reason text:=trim(left(coalesce(p_reason,''),500));
  v_id uuid;
begin
  if length(v_reason)<12 then raise exception 'review_reason_too_short'; end if;
  select * into v_game from public.game_attempts where id=p_attempt and user_id=p_user;
  if not found then raise exception 'game_not_found'; end if;
  select value into v_response from jsonb_array_elements(v_game.answers)
    where value->>'questionId'=p_question and value->>'valid'='false'
      and char_length(coalesce(value->>'response','')) between 1 and 100
    limit 1;
  if v_response is null then raise exception 'review_requires_invalid_answer'; end if;
  if (select count(*) from public.answer_reviews
      where user_id=p_user and created_at>clock_timestamp()-interval '24 hours')>=4 then
    raise exception 'review_rate_limit';
  end if;
  insert into public.answer_reviews(user_id,attempt_id,question_id,submitted_answer,reason)
    values(p_user,p_attempt,p_question,v_response->>'response',v_reason)
    on conflict (user_id,attempt_id,question_id) do update
      set reason=excluded.reason
      where public.answer_reviews.status='pending'
    returning id into v_id;
  if v_id is null then raise exception 'review_already_processed'; end if;
  return jsonb_build_object('id',v_id,'status','pending');
end $$;

-- True historical answer frequencies are observed only from prior completed
-- official games. Suppress fine-grained counts until at least 30 responses
-- have been recorded; no user or email data ever leaves this aggregation.
create or replace function public.outlier_past_answer_rarity(p_question text)
returns jsonb language plpgsql stable security definer
set search_path=public,private,pg_temp as $$
declare
  v_total integer;
  v_response jsonb;
begin
  with responses as (
    select a.value->>'accepted' as answer
    from public.game_attempts g
    cross join lateral jsonb_array_elements(g.answers) a(value)
    where g.mode='daily' and g.completed_at is not null
      and g.game_day < (clock_timestamp() at time zone 'UTC')::date
      and a.value->>'questionId'=p_question
  )
  select count(*)::int into v_total from responses;
  if v_total < 30 then
    return jsonb_build_object('available',false,'minimum',30);
  end if;
  with responses as (
    select a.value->>'accepted' as answer
    from public.game_attempts g
    cross join lateral jsonb_array_elements(g.answers) a(value)
    where g.mode='daily' and g.completed_at is not null
      and g.game_day < (clock_timestamp() at time zone 'UTC')::date
      and a.value->>'questionId'=p_question
  ), counts as (
    select answer,count(*)::int as picks
    from responses where answer is not null group by answer
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'name',answer,'picks',picks,'percent',round((picks::numeric/v_total)*100,1)
  ) order by picks desc,answer),'[]'::jsonb) into v_response from counts;
  return jsonb_build_object('available',true,'sampleSize',v_total,'answers',v_response);
end $$;

-- Newly created functions default to PUBLIC EXECUTE in PostgreSQL unless revoked.
revoke all on function public.outlier_league_create(uuid,text) from public,anon,authenticated;
revoke all on function public.outlier_league_join(uuid,text) from public,anon,authenticated;
revoke all on function public.outlier_league_list(uuid) from public,anon,authenticated;
revoke all on function public.outlier_league_standings(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.outlier_weekly_leaderboard(integer) from public,anon,authenticated;
revoke all on function public.outlier_player_history(uuid,integer) from public,anon,authenticated;
revoke all on function public.outlier_review_submit(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.outlier_past_answer_rarity(text) from public,anon,authenticated;
grant execute on function public.outlier_league_create(uuid,text) to service_role;
grant execute on function public.outlier_league_join(uuid,text) to service_role;
grant execute on function public.outlier_league_list(uuid) to service_role;
grant execute on function public.outlier_league_standings(uuid,uuid,text) to service_role;
grant execute on function public.outlier_weekly_leaderboard(integer) to service_role;
grant execute on function public.outlier_player_history(uuid,integer) to service_role;
grant execute on function public.outlier_review_submit(uuid,uuid,text,text) to service_role;
grant execute on function public.outlier_past_answer_rarity(text) to service_role;


-- Equivalent to the guest one-edit typo rule, never broad fuzzy matching.
create or replace function private.outlier_one_typo(a text,b text)
returns boolean language plpgsql immutable strict
set search_path=private,pg_temp as $$
declare
  i integer:=1; j integer:=1;
  la integer:=length(a); lb integer:=length(b);
  edits integer:=0;
begin
  if a=b or abs(la-lb)>1 then return false; end if;
  while i<=la and j<=lb loop
    if substr(a,i,1)=substr(b,j,1) then
      i:=i+1; j:=j+1;
    else
      edits:=edits+1;
      if edits>1 then return false; end if;
      if la>lb then i:=i+1;
      elsif lb>la then j:=j+1;
      else i:=i+1;j:=j+1;end if;
    end if;
  end loop;
  edits:=edits+(la-i+1)+(lb-j+1);
  return edits=1;
end $$;
revoke all on function private.outlier_one_typo(text,text) from public,anon,authenticated;

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
revoke all on function public.outlier_answer(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.outlier_answer(uuid,uuid,integer,text) to service_role;
