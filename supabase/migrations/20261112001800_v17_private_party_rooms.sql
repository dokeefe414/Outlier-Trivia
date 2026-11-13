-- OUTLIER v1.7 / OPTIONAL private server-verified synchronized rooms.
-- Never expose the private question bank, score keys, service role or membership
-- tables directly to the browser. Only authenticated Edge routes call these
-- service_role-only functions after verifying the caller's token.
-- Requires a separately provisioned, vetted private ranked question bank.
create table if not exists public.outlier_party_rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  invite_code text not null unique check (invite_code ~ '^[a-f0-9]{12}$'),
  status text not null default 'waiting' check (status in ('waiting','playing')),
  question_ids text[] not null default '{}'::text[],
  created_at timestamptz not null default clock_timestamp(),
  starts_at timestamptz,
  expires_at timestamptz not null default (clock_timestamp()+interval '30 minutes'),
  check ((status='waiting' and starts_at is null and cardinality(question_ids)=0)
      or (status='playing' and starts_at is not null and cardinality(question_ids)=7))
);
create table if not exists public.outlier_party_members (
  room_id uuid not null references public.outlier_party_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default clock_timestamp(),
  primary key (room_id,user_id)
);
create table if not exists private.outlier_party_answers (
  room_id uuid not null,
  user_id uuid not null,
  question_index integer not null check (question_index between 0 and 6),
  response text not null check (length(response)<=100),
  accepted text,
  points integer not null check (points between 0 and 1000),
  submitted_at timestamptz not null default clock_timestamp(),
  primary key (room_id,user_id,question_index),
  foreign key (room_id,user_id) references public.outlier_party_members(room_id,user_id)
    on delete cascade
);
create index if not exists outlier_party_owner_idx
  on public.outlier_party_rooms(owner_id,created_at desc);
create index if not exists outlier_party_member_user_idx
  on public.outlier_party_members(user_id);
alter table public.outlier_party_rooms enable row level security;
alter table public.outlier_party_members enable row level security;
alter table private.outlier_party_answers enable row level security;
revoke all on public.outlier_party_rooms,public.outlier_party_members,
  private.outlier_party_answers from public,anon,authenticated;

create or replace function public.outlier_party_create(p_user uuid)
returns jsonb language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare
  v_room uuid;
  v_code text;
begin
  if not exists(select 1 from auth.users where id=p_user) then
    raise exception 'party_auth_required';
  end if;
  if (select count(*) from public.outlier_party_rooms
    where owner_id=p_user and status='waiting'
      and expires_at>clock_timestamp())>=3 then
    raise exception 'party_room_limit';
  end if;
  if (select count(*) from public.outlier_party_rooms
    where owner_id=p_user and created_at>clock_timestamp()-interval '1 day')>=12 then
    raise exception 'party_daily_room_limit';
  end if;
  loop
    v_code:=left(replace(gen_random_uuid()::text,'-',''),12);
    begin
      insert into public.outlier_party_rooms(owner_id,invite_code)
        values(p_user,v_code) returning id into v_room;
      exit;
    exception when unique_violation then continue;
    end;
  end loop;
  insert into public.outlier_party_members(room_id,user_id) values(v_room,p_user);
  return jsonb_build_object('id',v_room,'code',v_code,'status','waiting');
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
      where room_id=v_room.id)>=4 then raise exception 'party_room_full';end if;
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
  -- Never use a question already sealed in *any* official daily slate.
  -- Playing the same source material privately must not leak ranked answers.
  select array_agg(id order by ordering) into v_rare from (
    select q.id,md5(p_room::text||q.id) as ordering
    from private.ranked_question_bank q
    where q.kind='rare'
      and not exists(select 1 from private.official_daily_slates s
        where q.id=any(s.question_ids))
    order by md5(p_room::text||q.id) limit 4
  ) selection;
  select array_agg(id order by ordering) into v_fit from (
    select q.id,md5(p_room::text||q.id) as ordering
    from private.ranked_question_bank q
    where q.kind='fit'
      and not exists(select 1 from private.official_daily_slates s
        where q.id=any(s.question_ids))
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
returns jsonb language plpgsql stable security definer
set search_path=public,private,pg_temp as $$
declare
  v_room public.outlier_party_rooms%rowtype;
  v_now timestamptz:=clock_timestamp();
  v_phase text;
  v_index int;
  v_question private.ranked_question_bank%rowtype;
  v_pledges jsonb;
  v_has boolean;
  v_members jsonb;
  v_scoreboard jsonb:=null;
  v_answers jsonb:=null;
  v_choices jsonb:=null;
begin
  if not exists(select 1 from public.outlier_party_members
      where room_id=p_room and user_id=p_user) then
    raise exception 'party_not_a_member';
  end if;
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
  select jsonb_agg(jsonb_build_object('id',m.user_id,'name',p.display_name)
    order by m.joined_at,m.user_id) into v_members
    from public.outlier_party_members m
    join public.profiles p on p.user_id=m.user_id
    where m.room_id=p_room;
  if v_phase='playing' then
    select * into v_question from private.ranked_question_bank
      where id=v_room.question_ids[v_index+1];
    select exists(select 1 from private.outlier_party_answers a
      where a.room_id=p_room and a.user_id=p_user
        and a.question_index=v_index) into v_has;
    if v_question.kind='fit' then
      select jsonb_agg(value->>0) into v_choices
      from jsonb_array_elements(v_question.choices);
    end if;
  elsif v_phase='finished' then
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
    'scores',v_scoreboard,'answers',v_answers
  );
end $$;

create or replace function public.outlier_party_answer(
  p_user uuid,p_room uuid,p_index integer,p_response text
) returns jsonb language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare
  v_room public.outlier_party_rooms%rowtype;
  v_q private.ranked_question_bank%rowtype;
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
     v_now>=v_room.starts_at+interval '315 seconds' then
    raise exception 'party_not_playing';
  end if;
  v_idx:=floor(extract(epoch from (v_now-v_room.starts_at))/45)::integer;
  if p_index<>v_idx or p_index not between 0 and 6 then
    raise exception 'party_round_expired';
  end if;
  if exists(select 1 from private.outlier_party_answers
    where room_id=p_room and user_id=p_user and question_index=v_idx) then
    raise exception 'party_already_answered';
  end if;
  select * into v_q from private.ranked_question_bank
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

-- PostgreSQL resolves definitions at runtime; start() may call state().
revoke all on function public.outlier_party_create(uuid) from public,anon,authenticated;
revoke all on function public.outlier_party_join(uuid,text) from public,anon,authenticated;
revoke all on function public.outlier_party_start(uuid,uuid) from public,anon,authenticated;
revoke all on function public.outlier_party_state(uuid,uuid) from public,anon,authenticated;
revoke all on function public.outlier_party_answer(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.outlier_party_create(uuid) to service_role;
grant execute on function public.outlier_party_join(uuid,text) to service_role;
grant execute on function public.outlier_party_start(uuid,uuid) to service_role;
grant execute on function public.outlier_party_state(uuid,uuid) to service_role;
grant execute on function public.outlier_party_answer(uuid,uuid,integer,text) to service_role;
