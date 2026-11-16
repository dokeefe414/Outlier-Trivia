-- OUTLIER v1.10.1: host-selected player count, 2–4, enforced by PostgreSQL.
-- Additive, legacy-compatible; never expose this table or RPC to browser roles.
alter table public.outlier_party_rooms
  add column if not exists target_players integer not null default 2
  check (target_players between 2 and 4);
-- Preserve active pre-upgrade rooms with three or four actual members.
update public.outlier_party_rooms r
set target_players=greatest(2,least(4,(select count(*) from public.outlier_party_members m
  where m.room_id=r.id)))
where r.status='waiting' and (select count(*) from public.outlier_party_members m
  where m.room_id=r.id)>2;

create or replace function public.outlier_party_target(
  p_user uuid,p_room uuid,p_target integer
) returns jsonb language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare v_room public.outlier_party_rooms%rowtype;
  v_members integer;
begin
  if p_target is null or p_target not between 2 and 4 then
    raise exception 'invalid_party_target';end if;
  select * into v_room from public.outlier_party_rooms where id=p_room for update;
  if not found or v_room.status<>'waiting' or
    v_room.expires_at<=clock_timestamp() then raise exception 'party_room_unavailable';end if;
  if v_room.owner_id<>p_user then raise exception 'party_host_only';end if;
  select count(*) into v_members from public.outlier_party_members where room_id=p_room;
  if p_target<v_members then raise exception 'party_target_below_roster';end if;
  update public.outlier_party_rooms set target_players=p_target where id=p_room;
  -- Everyone must reconfirm READY because the required roster size changed.
  update public.outlier_party_members set ready=false where room_id=p_room;
  return jsonb_build_object('targetPlayers',p_target);
end $$;

create or replace function public.outlier_party_join(p_user uuid,p_code text)
returns jsonb language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare
  v_room public.outlier_party_rooms%rowtype;
begin
  if coalesce(p_code,'') !~ '^[a-f0-9]{12}$' then raise exception 'invalid_party_code';end if;
  select * into v_room from public.outlier_party_rooms
    where invite_code=p_code for update;
  if not found or v_room.status<>'waiting' or
    v_room.expires_at<=clock_timestamp() then raise exception 'party_room_unavailable';end if;
  if exists(select 1 from public.outlier_party_members
      where room_id=v_room.id and user_id=p_user) then
    return jsonb_build_object('id',v_room.id,'alreadyMember',true);
  end if;
  if (select count(*) from public.outlier_party_members
      where room_id=v_room.id)>=v_room.target_players then
    raise exception 'party_room_full';end if;
  if (select count(*) from public.outlier_party_members m
      join public.outlier_party_rooms r on r.id=m.room_id
      where m.user_id=p_user and r.expires_at>clock_timestamp())>=10 then
    raise exception 'party_membership_limit';
  end if;
  insert into public.outlier_party_members(room_id,user_id) values(v_room.id,p_user);
  return jsonb_build_object('id',v_room.id,'alreadyMember',false);
end $$;

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
      where room_id=p_room)<>v_room.target_players then
    raise exception 'party_need_target_players';
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
    'roundSeconds',v_room.round_seconds,'targetPlayers',v_room.target_players,
    'seriesLength',v_room.series_length,
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
        series_length,series_root_id,series_game,target_players)
        values(v_old.owner_id,v_code,v_old.round_seconds,v_old.series_length,
          coalesce(v_old.series_root_id,v_old.id),v_old.series_game+1,v_old.target_players) returning id into v_new;
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

create or replace function public.outlier_request_budget(
  p_user uuid,p_action text,p_max integer,p_window_seconds integer
) returns boolean language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare v_hits integer;v_bucket bigint;
begin
  if p_action not in ('start','answer','advance','league-create','league-join',
    'review','checkout','name','crowd-consent','party-create','party-join',
    'party-start','party-answer','party-ready','party-leave','party-rematch',
    'party-config','party-theme','party-target')
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

revoke all on function public.outlier_party_target(uuid,uuid,integer)
  from public,anon,authenticated;
grant execute on function public.outlier_party_target(uuid,uuid,integer)
  to service_role;
