-- OUTLIER v1.9 server-owned private game-night lobby and rivalry records.
-- All objects are RLS-protected and executable via the authenticated Edge
-- service role only. This migration DOES NOT populate any production bank.
alter table public.outlier_party_members
  add column if not exists ready boolean not null default false,
  add column if not exists last_seen_at timestamptz not null default clock_timestamp();
alter table public.outlier_party_rooms
  add column if not exists rematch_room_id uuid references public.outlier_party_rooms(id) on delete set null;
create table if not exists public.outlier_party_rematch_votes (
  room_id uuid not null,
  user_id uuid not null,
  voted_at timestamptz not null default clock_timestamp(),
  primary key(room_id,user_id),
  foreign key(room_id,user_id)
    references public.outlier_party_members(room_id,user_id) on delete cascade
);
alter table public.outlier_party_rematch_votes enable row level security;
revoke all on public.outlier_party_rematch_votes from public,anon,authenticated;

create or replace function public.outlier_party_ready(
  p_user uuid,p_room uuid,p_ready boolean
) returns jsonb language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare v_room public.outlier_party_rooms%rowtype;
begin
  select * into v_room from public.outlier_party_rooms where id=p_room for update;
  if not found or v_room.status<>'waiting' or
    v_room.expires_at<=clock_timestamp() then raise exception 'party_room_unavailable';end if;
  if not exists(select 1 from public.outlier_party_members
    where room_id=p_room and user_id=p_user) then raise exception 'party_not_a_member';end if;
  update public.outlier_party_members
    set ready=p_ready,last_seen_at=clock_timestamp()
    where room_id=p_room and user_id=p_user;
  return jsonb_build_object('ready',p_ready);
end $$;

create or replace function public.outlier_party_leave(p_user uuid,p_room uuid)
returns jsonb language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare v_room public.outlier_party_rooms%rowtype;
begin
  select * into v_room from public.outlier_party_rooms where id=p_room for update;
  if not found then raise exception 'party_room_not_found';end if;
  if v_room.status<>'waiting' or v_room.expires_at<=clock_timestamp() then
    raise exception 'party_room_unavailable';
  end if;
  if not exists(select 1 from public.outlier_party_members
    where room_id=p_room and user_id=p_user) then raise exception 'party_not_a_member';end if;
  if v_room.owner_id=p_user then
    delete from public.outlier_party_rooms where id=p_room;
  else
    delete from public.outlier_party_members where room_id=p_room and user_id=p_user;
  end if;
  return jsonb_build_object('left',true,'closed',v_room.owner_id=p_user);
end $$;

create or replace function public.outlier_party_start(p_user uuid,p_room uuid)
returns jsonb language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare
  v_room public.outlier_party_rooms%rowtype;
  v_rare text[];
  v_fit text[];
  v_ids text[];
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
  -- Deliberately draw only from a separate, human-curated ROOM bank.
  -- No official-day or future-ranked answer keys can be exposed.
  select array_agg(id order by ordering) into v_rare from (
    select q.id,md5(p_room::text||q.id) as ordering
    from private.outlier_party_question_bank q
    where q.kind='rare'
    order by md5(p_room::text||q.id) limit 4
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
    question_ids=v_ids,status='playing',
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
  elsif v_now>=v_room.starts_at+interval '315 seconds' then
    v_phase:='finished';v_index:=null;
  else
    v_phase:='playing';
    v_index:=floor(extract(epoch from (v_now-v_room.starts_at))/45)::integer;
  end if;
  select jsonb_agg(jsonb_build_object('id',m.user_id,'name',p.display_name,
    'ready',m.ready,'active',m.last_seen_at>=v_now-interval '15 seconds')
    order by m.joined_at,m.user_id) into v_members
    from public.outlier_party_members m
    join public.profiles p on p.user_id=m.user_id
    where m.room_id=p_room;
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
    'startedAt',v_room.starts_at,'serverTime',v_now,
    'question',case when v_phase='playing' then jsonb_build_object(
      'index',v_index,'type',v_question.kind,'category',v_question.category,
      'prompt',v_question.prompt,'detail',v_question.detail,'choices',v_choices,
      'deadline',v_room.starts_at+make_interval(secs=>(v_index+1)*45),
      'submitted',v_has) else null end,
    'scores',v_scoreboard,'answers',v_answers,'questions',v_history,
    'rematch',case when v_phase='finished' then
      jsonb_build_object('votes',(select count(*) from public.outlier_party_rematch_votes
        where room_id=p_room),
        'needed',(select count(*) from public.outlier_party_members where room_id=p_room),
        'voted',exists(select 1 from public.outlier_party_rematch_votes
          where room_id=p_room and user_id=p_user),
        'roomId',v_room.rematch_room_id)
      else null end
  );
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
    clock_timestamp()<v_old.starts_at+interval '315 seconds' then
    raise exception 'party_rematch_not_finished';
  end if;
  if not exists(select 1 from public.outlier_party_members
    where room_id=p_room and user_id=p_user) then raise exception 'party_not_a_member';end if;
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
      insert into public.outlier_party_rooms(owner_id,invite_code)
        values(v_old.owner_id,v_code) returning id into v_new;
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

-- Member-only, server-derived finished room history, no raw answers.
create or replace function public.outlier_party_history(p_user uuid,p_limit int default 20)
returns jsonb language sql stable security definer
set search_path=public,private,pg_temp as $$
with rooms as (
  select r.id,r.starts_at from public.outlier_party_rooms r
  join public.outlier_party_members m
    on m.room_id=r.id and m.user_id=p_user
  where r.status='playing' and r.starts_at+interval '315 seconds'<=clock_timestamp()
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
      and r.starts_at+interval '315 seconds'<=clock_timestamp()
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
begin
  if p_user=p_opponent then raise exception 'invalid_party_opponent';end if;
  with rooms as (
    select r.id from public.outlier_party_rooms r
    join public.outlier_party_members u on u.room_id=r.id and u.user_id=p_user
    join public.outlier_party_members o on o.room_id=r.id and o.user_id=p_opponent
    where r.status='playing' and r.starts_at+interval '315 seconds'<=clock_timestamp()
    order by r.starts_at desc limit 150
  ), scores as (
    select rooms.id, m.user_id,coalesce(sum(a.points),0)::integer as score
    from rooms join public.outlier_party_members m on m.room_id=rooms.id
    left join private.outlier_party_answers a
      on a.room_id=m.room_id and a.user_id=m.user_id
    group by rooms.id,m.user_id
  ), pairs as (
    select id,max(score) filter(where user_id=p_user) as you,
      max(score) filter(where user_id=p_opponent) as them
    from scores group by id
  )
  select count(*) filter(where you>them),count(*) filter(where you<them),
    count(*) filter(where you=them),count(*)
  into v_wins,v_losses,v_ties,v_shared from pairs;
  return jsonb_build_object('opponent',p_opponent,'wins',v_wins,
    'losses',v_losses,'ties',v_ties,'shared',v_shared);
end $$;

-- Protect entry points from ordinary browser SQL/PostgREST access.
revoke all on function public.outlier_party_ready(uuid,uuid,boolean),
  public.outlier_party_leave(uuid,uuid),
  public.outlier_party_vote_rematch(uuid,uuid),
  public.outlier_party_history(uuid,int),
  public.outlier_party_season(uuid,text),
  public.outlier_party_rivalry(uuid,uuid) from public,anon,authenticated;
grant execute on function public.outlier_party_ready(uuid,uuid,boolean),
  public.outlier_party_leave(uuid,uuid),
  public.outlier_party_vote_rematch(uuid,uuid),
  public.outlier_party_history(uuid,int),
  public.outlier_party_season(uuid,text),
  public.outlier_party_rivalry(uuid,uuid) to service_role;
-- The existing start/state endpoints stay service_role-only under replacement.
create or replace function public.outlier_request_budget(
  p_user uuid,p_action text,p_max integer,p_window_seconds integer
) returns boolean language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare v_hits integer;v_bucket bigint;
begin
  if p_action not in ('start','answer','advance','league-create','league-join',
    'review','checkout','name','crowd-consent','party-create','party-join',
    'party-start','party-answer','party-ready','party-leave','party-rematch')
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
revoke all on function public.outlier_request_budget(uuid,text,integer,integer)
  from public,anon,authenticated;
grant execute on function public.outlier_request_budget(uuid,text,integer,integer)
  to service_role;
