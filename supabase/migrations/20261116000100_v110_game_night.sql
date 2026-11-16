-- OUTLIER v1.10 Game Night 2.0
-- ADDITIVE: existing defaults preserved (45 seconds, original seven rounds).
-- Server-owned room settings, one member-one theme vote, 1/3/5-game series,
-- membership-protected progression, and timing correctness for every record.
-- Do not seed unpublished answer keys or broaden browser grants.
alter table public.outlier_party_rooms
  add column if not exists round_seconds integer not null default 45
    check (round_seconds in (20,30,45,60,90)),
  add column if not exists series_length integer not null default 3
    check (series_length in (1,3,5)),
  add column if not exists series_game integer not null default 1
    check (series_game between 1 and 5),
  add column if not exists series_root_id uuid references public.outlier_party_rooms(id)
    on delete set null,
  add column if not exists selected_theme text not null default 'MIXED';
-- Legacy rooms were single exhibition games, not contracted series.
update public.outlier_party_rooms set series_length=1
  where series_root_id is null and series_game=1
  and created_at < '2026-11-16T00:00:00Z';
create table if not exists public.outlier_party_theme_votes(
  room_id uuid not null,
  user_id uuid not null,
  theme text not null check(theme in
    ('MOVIES','MUSIC','SCIENCE','FOOD','SPORTS','ANIMALS','GEOGRAPHY','GAMES')),
  voted_at timestamptz not null default clock_timestamp(),
  primary key(room_id,user_id),
  foreign key(room_id,user_id) references public.outlier_party_members(room_id,user_id)
    on delete cascade
);
alter table public.outlier_party_theme_votes enable row level security;
revoke all on public.outlier_party_theme_votes from public,anon,authenticated;

create or replace function public.outlier_party_configure(
  p_user uuid,p_room uuid,p_seconds integer,p_series_length integer
) returns jsonb language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare v_room public.outlier_party_rooms%rowtype;
begin
  if p_seconds not in (20,30,45,60,90) or p_series_length not in (1,3,5)
     or p_seconds is null or p_series_length is null then
    raise exception 'invalid_party_config';end if;
  select * into v_room from public.outlier_party_rooms where id=p_room for update;
  if not found or v_room.status<>'waiting' or v_room.expires_at<=clock_timestamp()
    then raise exception 'party_room_unavailable';end if;
  if v_room.owner_id<>p_user then raise exception 'party_host_only';end if;
  update public.outlier_party_rooms
     set round_seconds=p_seconds,series_length=p_series_length
     where id=p_room;
  -- Configuration changes invalidate everyone else's previous consent.
  update public.outlier_party_members set ready=false where room_id=p_room;
  return jsonb_build_object('roundSeconds',p_seconds,'seriesLength',p_series_length);
end $$;

create or replace function public.outlier_party_theme_vote(
  p_user uuid,p_room uuid,p_theme text
) returns jsonb language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare v_room public.outlier_party_rooms%rowtype;
begin
  if p_theme is null or p_theme not in
    ('MOVIES','MUSIC','SCIENCE','FOOD','SPORTS','ANIMALS','GEOGRAPHY','GAMES')
    then raise exception 'invalid_party_theme';end if;
  select * into v_room from public.outlier_party_rooms where id=p_room for update;
  if not found or v_room.status<>'waiting' or v_room.expires_at<=clock_timestamp()
    then raise exception 'party_room_unavailable';end if;
  if not exists(select 1 from public.outlier_party_members
      where room_id=p_room and user_id=p_user) then raise exception 'party_not_a_member';end if;
  insert into public.outlier_party_theme_votes(room_id,user_id,theme)
    values(p_room,p_user,p_theme)
    on conflict(room_id,user_id) do update set theme=excluded.theme,
      voted_at=clock_timestamp();
  -- A vote can change the actual draw: require everyone's renewed ready consent.
  update public.outlier_party_members set ready=false where room_id=p_room;
  return jsonb_build_object('theme',p_theme,'accepted',true);
end $$;

-- Only an authenticated room member may see their own series. No raw guesses.
create or replace function public.outlier_party_series(p_user uuid,p_room uuid)
returns jsonb language plpgsql stable security definer
set search_path=public,private,pg_temp as $$
declare v_room public.outlier_party_rooms%rowtype;
  v_root uuid; v_played integer; v_standings jsonb;
begin
  select * into v_room from public.outlier_party_rooms where id=p_room;
  if not found or not exists(select 1 from public.outlier_party_members
     where room_id=p_room and user_id=p_user) then
     raise exception 'party_not_a_member';end if;
  v_root:=coalesce(v_room.series_root_id,v_room.id);
  with finished as (
    select r.id,r.series_game from public.outlier_party_rooms r
    where (r.id=v_root or r.series_root_id=v_root)
      and r.status='playing' and
      r.starts_at+make_interval(secs=>7*r.round_seconds)<=clock_timestamp()
    order by r.series_game limit 5
  ), scores as (
    select f.id as room_id,m.user_id,p.display_name,
      coalesce(sum(a.points),0)::integer as score
    from finished f join public.outlier_party_members m on m.room_id=f.id
    join public.profiles p on p.user_id=m.user_id
    left join private.outlier_party_answers a
      on a.room_id=m.room_id and a.user_id=m.user_id
    group by f.id,m.user_id,p.display_name
  ), ranked as (
    select *,max(score) over(partition by room_id) as top,
      count(*) over(partition by room_id,score) as tied
    from scores
  ), totals as (
    select user_id,max(display_name) as name,count(*)::integer as games,
      count(*) filter(where score=top and tied=1)::integer as wins,
      count(*) filter(where score=top and tied>1)::integer as ties,
      sum(score)::integer as points
    from ranked group by user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'name',name,
      'games',games,'wins',wins,'ties',ties,'points',points)
      order by wins desc,points desc,name),'[]'::jsonb)
    into v_standings from totals;
  select count(*) into v_played from public.outlier_party_rooms r
   where (r.id=v_root or r.series_root_id=v_root)
     and r.status='playing'
     and r.starts_at+make_interval(secs=>7*r.round_seconds)<=clock_timestamp();
  return jsonb_build_object('root',v_root,'game',v_room.series_game,
    'length',v_room.series_length,'played',v_played,
    'complete',v_played>=v_room.series_length,
    'standings',coalesce(v_standings,'[]'::jsonb));
end $$;

-- Authenticated private-game progress is distinct from official ranked daily.
create or replace function public.outlier_party_mastery(p_user uuid)
returns jsonb language sql stable security definer
set search_path=public,private,pg_temp as $$
with recent as (
  select r.id from public.outlier_party_rooms r
  join public.outlier_party_members m on m.room_id=r.id and m.user_id=p_user
  where r.status='playing'
    and r.starts_at+make_interval(secs=>7*r.round_seconds)<=clock_timestamp()
  order by r.starts_at desc limit 150
), scores as (
  select r.id,m.user_id,coalesce(sum(a.points),0)::integer as score
  from recent r join public.outlier_party_members m on m.room_id=r.id
  left join private.outlier_party_answers a
    on a.room_id=m.room_id and a.user_id=m.user_id
  group by r.id,m.user_id
), totals as (
  select id,user_id,score,max(score) over(partition by id) as top,
    count(*) over(partition by id,score) as tied from scores
), owned as (select * from totals where user_id=p_user)
select jsonb_build_object(
  'games',count(*)::integer,'wins',count(*) filter(where score=top and tied=1)::integer,
  'ties',count(*) filter(where score=top and tied>1)::integer,
  'bestScore',coalesce(max(score),0),
  'totalPoints',coalesce(sum(score),0)::integer,
  'rareHits',(select count(*) from private.outlier_party_answers a
     join recent r on r.id=a.room_id where a.user_id=p_user
       and a.points>=850 and a.accepted is not null))
from owned
$$;


create or replace function public.outlier_party_start(p_user uuid,p_room uuid)
returns jsonb language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare
  v_room public.outlier_party_rooms%rowtype;
  v_rare text[];
  v_fit text[];
  v_ids text[];
  v_theme text;
begin
  select * into v_room from public.outlier_party_rooms
    where id=p_room for update;
  if not found then raise exception 'party_room_not_found';end if;
  if v_room.owner_id<>p_user then raise exception 'party_host_only';end if;
  if v_room.status<>'waiting' or v_room.expires_at<=clock_timestamp() then
    raise exception 'party_room_unavailable';
  end if;
  if (select count(*) from public.outlier_party_members
      where room_id=p_room) not between 2 and 4 then
    raise exception 'party_need_two_to_four';
  end if;
  if exists(select 1 from public.outlier_party_members where room_id=p_room and not ready) then
    raise exception 'party_members_not_ready';
  end if;
  select t.theme into v_theme from public.outlier_party_theme_votes t
    where t.room_id=p_room
    group by t.theme order by count(*) desc,t.theme limit 1;
  -- Deliberately draw only from a separate, human-curated ROOM bank.
  -- No official-day or future-ranked answer keys can be exposed.
  select array_agg(id order by preference,ordering) into v_rare from (
    select q.id,md5(p_room::text||q.id) as ordering,
      case when q.category=v_theme then 0 else 1 end as preference
    from private.outlier_party_question_bank q
    where q.kind='rare'
    order by preference,md5(p_room::text||q.id) limit 4
  ) selection;
  select array_agg(id order by ordering) into v_fit from (
    select q.id,md5(p_room::text||q.id) as ordering
    from private.outlier_party_question_bank q
    where q.kind='fit'
    order by md5(p_room::text||q.id) limit 3
  ) selection;
  if cardinality(coalesce(v_rare,array[]::text[]))<>4 or
    cardinality(coalesce(v_fit,array[]::text[]))<>3 then
    raise exception 'party_private_bank_not_ready';
  end if;
  v_ids:=array[v_rare[1],v_fit[1],v_rare[2],v_fit[2],
    v_rare[3],v_fit[3],v_rare[4]];
  update public.outlier_party_rooms set
    question_ids=v_ids,status='playing',selected_theme=coalesce(v_theme,'MIXED'),
    starts_at=clock_timestamp()+interval '5 seconds',
    expires_at=clock_timestamp()+interval '1 hour'
    where id=p_room;
  return public.outlier_party_state(p_user,p_room);
end $$;

create or replace function public.outlier_party_state(p_user uuid,p_room uuid)
returns jsonb language plpgsql volatile security definer
set search_path=public,private,pg_temp as $$
declare
  v_room public.outlier_party_rooms%rowtype;
  v_now timestamptz:=clock_timestamp();
  v_phase text;
  v_index int;
  v_question private.outlier_party_question_bank%rowtype;
  v_pledges jsonb;
  v_has boolean;
  v_members jsonb;
  v_scoreboard jsonb:=null;
  v_answers jsonb:=null;
  v_history jsonb:=null;
  v_choices jsonb:=null;
  v_theme_votes jsonb:='[]'::jsonb;
begin
  if not exists(select 1 from public.outlier_party_members
      where room_id=p_room and user_id=p_user) then
    raise exception 'party_not_a_member';
  end if;
  update public.outlier_party_members set last_seen_at=v_now
    where room_id=p_room and user_id=p_user;
  select * into v_room from public.outlier_party_rooms where id=p_room;
  if not found then raise exception 'party_room_not_found';end if;
  if v_room.status='waiting' then
    v_phase:=case when v_room.expires_at<v_now then 'expired' else 'waiting' end;
    v_index:=null;
  elsif v_now<v_room.starts_at then
    v_phase:='countdown';v_index:=null;
  elsif v_now>=v_room.starts_at+make_interval(secs=>7*v_room.round_seconds) then
    v_phase:='finished';v_index:=null;
  else
    v_phase:='playing';
    v_index:=floor(extract(epoch from (v_now-v_room.starts_at))/v_room.round_seconds)::integer;
  end if;
  select jsonb_agg(jsonb_build_object('id',m.user_id,'name',p.display_name,
    'ready',m.ready,'active',m.last_seen_at>=v_now-interval '15 seconds')
    order by m.joined_at,m.user_id) into v_members
    from public.outlier_party_members m
    join public.profiles p on p.user_id=m.user_id
    where m.room_id=p_room;
  if v_phase='waiting' then
    select coalesce(jsonb_agg(jsonb_build_object('theme',t.theme,'votes',t.votes)
      order by t.votes desc,t.theme),'[]'::jsonb) into v_theme_votes
    from (select theme,count(*)::integer as votes
      from public.outlier_party_theme_votes where room_id=p_room group by theme) t;
  end if;
  if v_phase='playing' then
    select * into v_question from private.outlier_party_question_bank
      where id=v_room.question_ids[v_index+1];
    select exists(select 1 from private.outlier_party_answers a
      where a.room_id=p_room and a.user_id=p_user
        and a.question_index=v_index) into v_has;
    if v_question.kind='fit' then
      select jsonb_agg(value->>0) into v_choices
      from jsonb_array_elements(v_question.choices);
    end if;
  elsif v_phase='finished' then
    select jsonb_agg(jsonb_build_object('index',c.index-1,
      'prompt',q.prompt,'type',q.kind,'category',q.category)
      order by c.index) into v_history
    from unnest(v_room.question_ids) with ordinality c(id,index)
    join private.outlier_party_question_bank q on q.id=c.id;
    select jsonb_agg(jsonb_build_object('id',s.user_id,'name',s.display_name,
      'score',s.score) order by s.score desc,s.display_name) into v_scoreboard
    from (
      select m.user_id,p.display_name,coalesce(sum(a.points),0)::int as score
      from public.outlier_party_members m
      join public.profiles p on p.user_id=m.user_id
      left join private.outlier_party_answers a on a.room_id=m.room_id
        and a.user_id=m.user_id
      where m.room_id=p_room
      group by m.user_id,p.display_name
    ) s;
    select jsonb_agg(jsonb_build_object('index',a.question_index,
      'player',a.user_id,'accepted',a.accepted,'points',a.points)
      order by a.question_index,a.submitted_at) into v_answers
    from private.outlier_party_answers a where a.room_id=p_room;
  end if;
  return jsonb_build_object(
    'id',v_room.id,'code',v_room.invite_code,'phase',v_phase,
    'host',v_room.owner_id,'players',coalesce(v_members,'[]'::jsonb),
    'roundSeconds',v_room.round_seconds,'seriesLength',v_room.series_length,
    'seriesGame',v_room.series_game,'selectedTheme',v_room.selected_theme,
    'themeVotes',v_theme_votes,
    'myTheme',(select theme from public.outlier_party_theme_votes
      where room_id=p_room and user_id=p_user),
    'startedAt',v_room.starts_at,'serverTime',v_now,
    'question',case when v_phase='playing' then jsonb_build_object(
      'index',v_index,'type',v_question.kind,'category',v_question.category,
      'prompt',v_question.prompt,'detail',v_question.detail,'choices',v_choices,
      'deadline',v_room.starts_at+make_interval(secs=>(v_index+1)*v_room.round_seconds),
      'submitted',v_has) else null end,
    'scores',v_scoreboard,'answers',v_answers,'questions',v_history,
    'series',case when v_phase='finished' then
      public.outlier_party_series(p_user,p_room) else null end,
    'rematch',case when v_phase='finished' then
      jsonb_build_object('votes',(select count(*) from public.outlier_party_rematch_votes
        where room_id=p_room),
        'needed',(select count(*) from public.outlier_party_members where room_id=p_room),
        'voted',exists(select 1 from public.outlier_party_rematch_votes
          where room_id=p_room and user_id=p_user),
        'roomId',v_room.rematch_room_id,
        'seriesComplete',v_room.series_game>=v_room.series_length)
      else null end
  );
end $$;

create or replace function public.outlier_party_answer(
  p_user uuid,p_room uuid,p_index integer,p_response text
) returns jsonb language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare
  v_room public.outlier_party_rooms%rowtype;
  v_q private.outlier_party_question_bank%rowtype;
  v_now timestamptz:=clock_timestamp();
  v_idx integer;
  v_row jsonb;
  v_alias jsonb;
  v_label text:=null;
  v_points integer:=0;
  v_share integer;
  v_max integer;
  v_norm text:=private.normalized_answer(left(coalesce(p_response,''),100));
  v_candidate text;
  v_candidate_points integer;
  v_ambiguous boolean:=false;
  v_near boolean;
begin
  select * into v_room from public.outlier_party_rooms
    where id=p_room for update;
  if not found or not exists(select 1 from public.outlier_party_members
    where room_id=p_room and user_id=p_user) then raise exception 'party_not_a_member';end if;
  if v_room.status<>'playing' or v_now<v_room.starts_at or
     v_now>=v_room.starts_at+make_interval(secs=>7*v_room.round_seconds) then
    raise exception 'party_not_playing';
  end if;
  v_idx:=floor(extract(epoch from (v_now-v_room.starts_at))/v_room.round_seconds)::integer;
  if p_index<>v_idx or p_index not between 0 and 6 then
    raise exception 'party_round_expired';
  end if;
  if exists(select 1 from private.outlier_party_answers
    where room_id=p_room and user_id=p_user and question_index=v_idx) then
    raise exception 'party_already_answered';
  end if;
  select * into v_q from private.outlier_party_question_bank
    where id=v_room.question_ids[v_idx+1];
  if not found then raise exception 'party_question_missing';end if;
  if length(v_norm)>0 then
    if v_q.kind='rare' then
      for v_row in select value from jsonb_array_elements(v_q.answers) loop
        if private.normalized_answer(v_row->>0)=v_norm or exists(
          select 1 from jsonb_array_elements_text(coalesce(v_row->2,'[]'::jsonb)) a
          where private.normalized_answer(a)=v_norm) then
          if v_label is not null and v_label<>(v_row->>0) then
            v_label:=null;v_points:=0;v_ambiguous:=true;exit;
          end if;
          v_label:=v_row->>0;v_points:=(v_row->>1)::int;
        end if;
      end loop;
      if v_label is null and not v_ambiguous and length(v_norm)>=5 then
        for v_row in select value from jsonb_array_elements(v_q.answers) loop
          v_near:=private.outlier_one_typo(v_norm,private.normalized_answer(v_row->>0));
          if not v_near and jsonb_typeof(v_row->2)='array' then
            for v_alias in select value from jsonb_array_elements(v_row->2) loop
              if private.outlier_one_typo(v_norm,private.normalized_answer(v_alias #>> '{}')) then
                v_near:=true;exit;
              end if;
            end loop;
          end if;
          if v_near then
            if v_candidate is not null and v_candidate<>(v_row->>0) then
              v_ambiguous:=true;exit;
            end if;
            v_candidate:=v_row->>0;
            v_candidate_points:=(v_row->>1)::int;
          end if;
        end loop;
        if not v_ambiguous and v_candidate is not null then
          v_label:=v_candidate;v_points:=v_candidate_points;
        end if;
      end if;
    else
      select max((value->>1)::int) into v_max
        from jsonb_array_elements(v_q.choices);
      for v_row in select value from jsonb_array_elements(v_q.choices) loop
        if private.normalized_answer(v_row->>0)=v_norm then
          v_label:=v_row->>0;
          v_share:=(v_row->>1)::int;
          v_points:=round(v_share::numeric/greatest(v_max,1)*1000)::int;
          exit;
        end if;
      end loop;
    end if;
  end if;
  insert into private.outlier_party_answers(room_id,user_id,question_index,
    response,accepted,points)
  values(p_room,p_user,v_idx,left(coalesce(p_response,''),100),v_label,v_points);
  -- No correct answer, points, or other players' outcomes until all rounds
  -- are closed by the single shared server timer.
  return jsonb_build_object('locked',true,'index',v_idx);
end $$;

create or replace function public.outlier_party_vote_rematch(p_user uuid,p_room uuid)
returns jsonb language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare
  v_old public.outlier_party_rooms%rowtype;
  v_new uuid;
  v_code text;
  v_total integer;
  v_votes integer;
begin
  select * into v_old from public.outlier_party_rooms where id=p_room for update;
  if not found or v_old.status<>'playing' or
    clock_timestamp()<v_old.starts_at+make_interval(secs=>7*v_old.round_seconds) then
    raise exception 'party_rematch_not_finished';
  end if;
  if not exists(select 1 from public.outlier_party_members
    where room_id=p_room and user_id=p_user) then raise exception 'party_not_a_member';end if;
  if v_old.series_game>=v_old.series_length then
    raise exception 'party_series_complete';
  end if;
  if v_old.rematch_room_id is not null then
    return jsonb_build_object('roomId',v_old.rematch_room_id,'ready',true);
  end if;
  insert into public.outlier_party_rematch_votes(room_id,user_id)
    values(p_room,p_user) on conflict do nothing;
  select count(*) into v_total from public.outlier_party_members where room_id=p_room;
  select count(*) into v_votes from public.outlier_party_rematch_votes where room_id=p_room;
  if v_total not between 2 and 4 then raise exception 'party_room_invalid';end if;
  if v_votes<v_total then
    return jsonb_build_object('roomId',null,'votes',v_votes,'needed',v_total,'ready',false);
  end if;
  -- All original members explicitly voted, so no user is silently rematched.
  loop
    v_code:=left(replace(gen_random_uuid()::text,'-',''),12);
    begin
      insert into public.outlier_party_rooms(owner_id,invite_code,round_seconds,
        series_length,series_root_id,series_game)
        values(v_old.owner_id,v_code,v_old.round_seconds,v_old.series_length,
          coalesce(v_old.series_root_id,v_old.id),v_old.series_game+1) returning id into v_new;
      exit;
    exception when unique_violation then continue;
    end;
  end loop;
  insert into public.outlier_party_members(room_id,user_id)
    select v_new,user_id from public.outlier_party_members where room_id=p_room
    order by joined_at,user_id;
  update public.outlier_party_rooms set rematch_room_id=v_new where id=p_room;
  return jsonb_build_object('roomId',v_new,'votes',v_votes,'needed',v_total,'ready',true);
end $$;

create or replace function public.outlier_party_history(p_user uuid,p_limit int default 20)
returns jsonb language sql stable security definer
set search_path=public,private,pg_temp as $$
with rooms as (
  select r.id,r.starts_at from public.outlier_party_rooms r
  join public.outlier_party_members m
    on m.room_id=r.id and m.user_id=p_user
  where r.status='playing' and r.starts_at+make_interval(secs=>7*r.round_seconds)<=clock_timestamp()
  order by r.starts_at desc limit least(30,greatest(1,p_limit))
), scores as (
  select rooms.id as room_id,rooms.starts_at,m.user_id,p.display_name,
    coalesce(sum(a.points),0)::integer as score
  from rooms join public.outlier_party_members m on m.room_id=rooms.id
  join public.profiles p on p.user_id=m.user_id
  left join private.outlier_party_answers a
    on a.room_id=m.room_id and a.user_id=m.user_id
  group by rooms.id,rooms.starts_at,m.user_id,p.display_name
), ranked as (
  select *,max(score) over(partition by room_id) as top_score,
    count(*) over(partition by room_id) as player_count
  from scores
), grouped as (
  select room_id,starts_at,max(player_count) as players,
    max(score) filter(where user_id=p_user) as your_score,
    max(top_score) as top_score,
    count(*) filter(where score=top_score) as top_ties,
    jsonb_agg(jsonb_build_object('id',user_id,'name',display_name)
      order by display_name) filter(where score=top_score) as winners
  from ranked group by room_id,starts_at
)
select coalesce(jsonb_agg(jsonb_build_object(
  'roomId',room_id,'startedAt',starts_at,'players',players,
  'yourScore',your_score,
  'outcome',case when your_score<top_score then 'loss'
    when top_ties>1 then 'tie' else 'win' end,
  'winners',winners) order by starts_at desc),'[]'::jsonb)
from grouped
$$;

-- All members in a room have consented to this room's private scorecard.
-- This is a friends-only SEASON, not a worldwide or rated leaderboard.
create or replace function public.outlier_party_season(p_user uuid,p_period text default 'month')
returns jsonb language plpgsql stable security definer
set search_path=public,private,pg_temp as $$
declare
  v_start timestamptz;
  v_rows jsonb;
begin
  if p_period not in ('month','week','all') then raise exception 'invalid_party_period';end if;
  v_start:=case p_period when 'month' then date_trunc('month',clock_timestamp())
    when 'week' then date_trunc('week',clock_timestamp())
    else '-infinity'::timestamptz end;
  with rooms as (
    select r.id,r.starts_at from public.outlier_party_rooms r
    join public.outlier_party_members m on m.room_id=r.id and m.user_id=p_user
    where r.status='playing' and r.starts_at>=v_start
      and r.starts_at+make_interval(secs=>7*r.round_seconds)<=clock_timestamp()
    order by r.starts_at desc limit 150
  ), scores as (
    select r.id as room_id,m.user_id,p.display_name,
      coalesce(sum(a.points),0)::integer as score
    from rooms r join public.outlier_party_members m on m.room_id=r.id
    join public.profiles p on p.user_id=m.user_id
    left join private.outlier_party_answers a
      on a.room_id=m.room_id and a.user_id=m.user_id
    group by r.id,m.user_id,p.display_name
  ), ranked as (
    select *,max(score) over(partition by room_id) as top,
      count(*) over(partition by room_id,score) as same_score
    from scores
  ), totals as (
    select user_id,max(display_name) as name,count(*)::integer as games,
      count(*) filter(where score=top and same_score=1)::integer as wins,
      count(*) filter(where score=top and same_score>1)::integer as ties,
      count(*) filter(where score<top)::integer as losses,
      sum(score)::integer as points
    from ranked group by user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',user_id,'name',name,'games',games,'wins',wins,'ties',ties,
    'losses',losses,'points',points)
    order by wins desc,points desc,name), '[]'::jsonb)
  into v_rows from totals;
  return v_rows;
end $$;

create or replace function public.outlier_party_season(p_user uuid,p_period text default 'month')
returns jsonb language plpgsql stable security definer
set search_path=public,private,pg_temp as $$
declare
  v_start timestamptz;
  v_rows jsonb;
begin
  if p_period not in ('month','week','all') then raise exception 'invalid_party_period';end if;
  v_start:=case p_period when 'month' then date_trunc('month',clock_timestamp())
    when 'week' then date_trunc('week',clock_timestamp())
    else '-infinity'::timestamptz end;
  with rooms as (
    select r.id,r.starts_at from public.outlier_party_rooms r
    join public.outlier_party_members m on m.room_id=r.id and m.user_id=p_user
    where r.status='playing' and r.starts_at>=v_start
      and r.starts_at+make_interval(secs=>7*r.round_seconds)<=clock_timestamp()
    order by r.starts_at desc limit 150
  ), scores as (
    select r.id as room_id,m.user_id,p.display_name,
      coalesce(sum(a.points),0)::integer as score
    from rooms r join public.outlier_party_members m on m.room_id=r.id
    join public.profiles p on p.user_id=m.user_id
    left join private.outlier_party_answers a
      on a.room_id=m.room_id and a.user_id=m.user_id
    group by r.id,m.user_id,p.display_name
  ), ranked as (
    select *,max(score) over(partition by room_id) as top,
      count(*) over(partition by room_id,score) as same_score
    from scores
  ), totals as (
    select user_id,max(display_name) as name,count(*)::integer as games,
      count(*) filter(where score=top and same_score=1)::integer as wins,
      count(*) filter(where score=top and same_score>1)::integer as ties,
      count(*) filter(where score<top)::integer as losses,
      sum(score)::integer as points
    from ranked group by user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',user_id,'name',name,'games',games,'wins',wins,'ties',ties,
    'losses',losses,'points',points)
    order by wins desc,points desc,name), '[]'::jsonb)
  into v_rows from totals;
  return v_rows;
end $$;

create or replace function public.outlier_party_rivalry(
  p_user uuid,p_opponent uuid
) returns jsonb language plpgsql stable security definer
set search_path=public,private,pg_temp as $$
declare v_wins int;v_losses int;v_ties int;v_shared int;
  v_recent jsonb:='[]'::jsonb;
begin
  if p_user=p_opponent then raise exception 'invalid_party_opponent';end if;
  with rooms as (
    select r.id,r.starts_at from public.outlier_party_rooms r
    join public.outlier_party_members u on u.room_id=r.id and u.user_id=p_user
    join public.outlier_party_members o on o.room_id=r.id and o.user_id=p_opponent
    where r.status='playing' and r.starts_at+make_interval(secs=>7*r.round_seconds)<=clock_timestamp()
    order by r.starts_at desc limit 150
  ), scores as (
    select rooms.id,rooms.starts_at,m.user_id,
      coalesce(sum(a.points),0)::integer as score
    from rooms join public.outlier_party_members m on m.room_id=rooms.id
    left join private.outlier_party_answers a
      on a.room_id=m.room_id and a.user_id=m.user_id
    group by rooms.id,rooms.starts_at,m.user_id
  ), pairs as (
    select id,starts_at,
      max(score) filter(where user_id=p_user) as you,
      max(score) filter(where user_id=p_opponent) as them
    from scores group by id,starts_at
  )
  select count(*) filter(where you>them),count(*) filter(where you<them),
    count(*) filter(where you=them),count(*),
    (select coalesce(jsonb_agg(
        jsonb_build_object('startedAt',t.starts_at,'you',t.you,'them',t.them,
          'outcome',case when t.you>t.them then 'win'
             when t.you<t.them then 'loss' else 'tie' end)
        order by t.starts_at desc),'[]'::jsonb)
      from (select * from pairs order by starts_at desc limit 10) t)
  into v_wins,v_losses,v_ties,v_shared,v_recent from pairs;
  return jsonb_build_object('opponent',p_opponent,'wins',v_wins,
    'losses',v_losses,'ties',v_ties,'shared',v_shared,'recent',v_recent);
end $$;

create or replace function public.outlier_request_budget(
  p_user uuid,p_action text,p_max integer,p_window_seconds integer
) returns boolean language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare v_hits integer;v_bucket bigint;
begin
  if p_action not in ('start','answer','advance','league-create','league-join',
    'review','checkout','name','crowd-consent','party-create','party-join',
    'party-start','party-answer','party-ready','party-leave','party-rematch',
    'party-config','party-theme')
    or p_max not between 1 and 300 or p_window_seconds not between 30 and 86400 then
    raise exception 'invalid_rate_limit_config';
  end if;
  v_bucket:=floor(extract(epoch from clock_timestamp())/p_window_seconds)::bigint;
  insert into private.request_budgets(user_id,action,window_bucket,hits)
    values(p_user,p_action,v_bucket,1)
    on conflict(user_id,action,window_bucket) do update set hits=private.request_budgets.hits+1
    returning hits into v_hits;
  return v_hits<=p_max;
end $$;


-- Explicitly keep every new SQL entrypoint non-callable through browser roles.
revoke all on function public.outlier_party_configure(uuid,uuid,integer,integer),
  public.outlier_party_theme_vote(uuid,uuid,text),
  public.outlier_party_series(uuid,uuid),
  public.outlier_party_mastery(uuid)
from public,anon,authenticated;
grant execute on function public.outlier_party_configure(uuid,uuid,integer,integer),
  public.outlier_party_theme_vote(uuid,uuid,text),
  public.outlier_party_series(uuid,uuid),
  public.outlier_party_mastery(uuid)
to service_role;
