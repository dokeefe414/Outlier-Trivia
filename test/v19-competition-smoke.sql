-- Disposable integration test: v1.9 ready-up, private room history, friend rivalry,
-- complete fair rematches, membership isolation and rate-limit privilege gates.
do $v19$
declare
  host uuid:='91919191-9191-4919-8919-919191919191';
  friend uuid:='92929292-9292-4929-8929-929292929292';
  guest uuid:='93939393-9393-4939-8939-939393939393';
  outsider uuid:='94949494-9494-4949-8949-949494949494';
  lobby jsonb; vroom uuid; invite text; state jsonb;started jsonb;
  newroom uuid; rematch jsonb; hist jsonb; season jsonb; rival jsonb;
  answer text; qid text;
begin
  insert into auth.users(id,email) values
    (host,'v19-host@example.test'),
    (friend,'v19-friend@example.test'),
    (guest,'v19-guest@example.test'),
    (outsider,'v19-outside@example.test');
  lobby:=public.outlier_party_create(host);
  vroom:=(lobby->>'id')::uuid; invite:=lobby->>'code';
  perform public.outlier_party_join(friend,invite);
  perform public.outlier_party_join(guest,invite);
  begin
    perform public.outlier_party_start(host,vroom);
    raise exception 'Host bypassed consent gate';
  exception when others then
    if sqlerrm='Host bypassed consent gate' then raise;end if;
    if position('party_members_not_ready' in sqlerrm)=0 then raise;end if;
  end;
  begin
    perform public.outlier_party_ready(outsider,vroom,true);
    raise exception 'Outsider forged readiness';
  exception when others then
    if sqlerrm='Outsider forged readiness' then raise;end if;
    if position('party_not_a_member' in sqlerrm)=0 then raise;end if;
  end;
  perform public.outlier_party_ready(host,vroom,true);
  perform public.outlier_party_ready(friend,vroom,true);
  perform public.outlier_party_ready(guest,vroom,true);
  state:=public.outlier_party_state(guest,vroom);
  if jsonb_array_length(state->'players')<>3 or
    (select count(*) from jsonb_array_elements(state->'players') x
      where x->>'ready'='true')<>3 then
    raise exception 'Readiness missing from state: %',state;
  end if;
  -- Liveness is a RECENT PING hint, not a guaranteed realtime socket.
  update public.outlier_party_members
    set last_seen_at=clock_timestamp()-interval '1 minute'
    where room_id=vroom and user_id=friend;
  state:=public.outlier_party_state(host,vroom);
  if (select x->>'active' from jsonb_array_elements(state->'players') x
      where (x->>'id')::uuid=friend)<>'false' then
    raise exception 'Inactive player is misrepresented as live';
  end if;
  perform public.outlier_party_ready(guest,vroom,false);
  begin
    perform public.outlier_party_start(host,vroom);
    raise exception 'Host started after guest un-readied';
  exception when others then
    if sqlerrm='Host started after guest un-readied' then raise;end if;
    if position('party_members_not_ready' in sqlerrm)=0 then raise;end if;
  end;
  perform public.outlier_party_ready(guest,vroom,true);
  started:=public.outlier_party_start(host,vroom);
  if started->>'phase'<>'countdown' then raise exception 'No synchronized start';end if;
  begin
    perform public.outlier_party_ready(guest,vroom,false);
    raise exception 'Readiness changed during playing';
  exception when others then
    if sqlerrm='Readiness changed during playing' then raise;end if;
    if position('party_room_unavailable' in sqlerrm)=0 then raise;end if;
  end;
  update public.outlier_party_rooms set starts_at=clock_timestamp()-interval '2 seconds'
    where id=vroom;
  select question_ids[1] into qid from public.outlier_party_rooms where id=vroom;
  select answers->0->>0 into answer from private.outlier_party_question_bank where id=qid;
  perform public.outlier_party_answer(host,vroom,0,answer);
  perform public.outlier_party_answer(friend,vroom,0,'not-a-real-answer');
  perform public.outlier_party_answer(guest,vroom,0,'not-a-real-answer');
  if jsonb_array_length(public.outlier_party_history(host,20))<>0 then
    raise exception 'Unfinished room leaked into verified history';
  end if;
  update public.outlier_party_rooms set starts_at=clock_timestamp()-interval '320 seconds'
    where id=vroom;
  hist:=public.outlier_party_history(host,20);
  if jsonb_array_length(hist)<>1 or hist->0->>'outcome'<>'win' then
    raise exception 'Server did not compute host win: %',hist;
  end if;
  if hist::text like '%not-a-real-answer%' or hist::text like '%questionIds%' then
    raise exception 'Private raw guess or sealed key leaked into history';
  end if;
  if jsonb_array_length(public.outlier_party_history(outsider,20))<>0 then
    raise exception 'Outsider discovered another room history';
  end if;
  season:=public.outlier_party_season(host,'month');
  if (select (x->>'wins')::int from jsonb_array_elements(season) x
      where (x->>'id')::uuid=host)<>1 then
    raise exception 'Month wins are not server-verified: %',season;
  end if;
  if (select (x->>'losses')::int from jsonb_array_elements(season) x
      where (x->>'id')::uuid=friend)<>1 then
    raise exception 'Friend loss not recorded: %',season;
  end if;
  if jsonb_array_length(public.outlier_party_season(outsider,'month'))<>0 then
    raise exception 'Nonparticipant saw private standings';
  end if;
  rival:=public.outlier_party_rivalry(host,friend);
  if rival->>'shared'<>'1' or rival->>'wins'<>'1' or rival->>'losses'<>'0' then
    raise exception 'Head-to-head verified record invalid: %',rival;
  end if;
  if jsonb_array_length(rival->'recent')<>1 or
    rival->'recent'->0->>'outcome'<>'win' or
    (rival->'recent'->0->>'you')::int<=(rival->'recent'->0->>'them')::int then
    raise exception 'Exact recent head-to-head event unavailable: %',rival;
  end if;
  if public.outlier_party_rivalry(host,outsider)->>'shared'<>'0' then
    raise exception 'Unrelated person is a fake rival';
  end if;
  begin
    perform public.outlier_party_vote_rematch(outsider,vroom);
    raise exception 'Outsider voted rematch';
  exception when others then
    if sqlerrm='Outsider voted rematch' then raise;end if;
    if position('party_not_a_member' in sqlerrm)=0 then raise;end if;
  end;
  rematch:=public.outlier_party_vote_rematch(host,vroom);
  if rematch->>'votes'<>'1' or rematch->>'roomId'<>'null' then
    raise exception 'First vote incorrectly launches a rematch: %',rematch;
  end if;
  rematch:=public.outlier_party_vote_rematch(host,vroom);
  if rematch->>'votes'<>'1' then raise exception 'Duplicate vote counted twice';end if;
  rematch:=public.outlier_party_vote_rematch(friend,vroom);
  if rematch->>'votes'<>'2' then raise exception 'Second vote not recorded';end if;
  rematch:=public.outlier_party_vote_rematch(guest,vroom);
  newroom:=(rematch->>'roomId')::uuid;
  if newroom is null or rematch->>'ready'<>'true' then
    raise exception 'Unanimous rematch did not start new waiting room: %',rematch;
  end if;
  state:=public.outlier_party_state(friend,newroom);
  if state->>'phase'<>'waiting' or jsonb_array_length(state->'players')<>3 then
    raise exception 'Consent-voted rematch did not preserve friends';
  end if;
  if (select count(*) from public.outlier_party_members
    where room_id=newroom and ready=false)<>3 then
    raise exception 'Rematch skipped the new lobby consent gate';
  end if;
  begin
    perform public.outlier_party_start(host,newroom);
    raise exception 'Rematch auto-started before new ready-up';
  exception when others then
    if sqlerrm='Rematch auto-started before new ready-up' then raise;end if;
    if position('party_members_not_ready' in sqlerrm)=0 then raise;end if;
  end;
  if has_function_privilege('authenticated',
    'public.outlier_party_vote_rematch(uuid,uuid)','EXECUTE') or
    has_function_privilege('authenticated',
      'public.outlier_party_history(uuid,integer)','EXECUTE') or
    has_table_privilege('authenticated',
      'public.outlier_party_rematch_votes','SELECT') then
    raise exception 'Game night exposed private SQL privileges';
  end if;
  -- A waiting guest may leave; an owner can close a lobby for everybody.
  perform public.outlier_party_leave(guest,newroom);
  if (select count(*) from public.outlier_party_members where room_id=newroom)<>2 then
    raise exception 'Guest leaving lobby did not update roster';
  end if;
  perform public.outlier_party_leave(host,newroom);
  if exists(select 1 from public.outlier_party_rooms where id=newroom) then
    raise exception 'Host could not cancel new waiting lobby';
  end if;
  raise notice 'v1.9 ready-up, liveness, verified seasons, rivalries, rematch unanimity and RLS PASS';
end $v19$;
