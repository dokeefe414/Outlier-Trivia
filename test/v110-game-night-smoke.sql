-- OUTLIER v1.10: disposable five-minute-ish simulated game-night series.
-- Uses fake auth.users and server-owned clocks. No real accounts or internet.
do $test_v110$
declare
 host uuid:='a1010101-1010-4010-8010-101010101010';
 guest uuid:='a2020202-2020-4020-8020-202020202020';
 outsider uuid:='a3030303-3030-4030-8030-303030303030';
 lobby jsonb; room uuid; next_room uuid; next2 uuid;
 payload jsonb; before_start jsonb; phase jsonb; results jsonb;
 fail_name text;
begin
 insert into auth.users(id,email) values
 (host,'v110-host@example.test'),(guest,'v110-guest@example.test'),
 (outsider,'v110-outsider@example.test');

 lobby:=public.outlier_party_create(host);
 room:=(lobby->>'id')::uuid;
 perform public.outlier_party_join(guest,lobby->>'code');

 -- Every room starts from a backwards-compatible 45-second schedule.
 select to_jsonb(r) into before_start from public.outlier_party_rooms r where id=room;
 if (before_start->>'round_seconds')::integer<>45 then
  raise exception 'Legacy default round_seconds was changed';end if;

 begin
  perform public.outlier_party_configure(guest,room,30,3);
  raise exception 'Non-host configured rules';
 exception when others then
  if sqlerrm='Non-host configured rules' then raise;end if;
  if position('party_host_only' in sqlerrm)=0 then raise;end if;
 end;
 begin
  perform public.outlier_party_theme_vote(outsider,room,'SCIENCE');
  raise exception 'Outsider cast topic vote';
 exception when others then
  if sqlerrm='Outsider cast topic vote' then raise;end if;
  if position('party_not_a_member' in sqlerrm)=0 then raise;end if;
 end;
 perform public.outlier_party_configure(host,room,30,3);
 perform public.outlier_party_theme_vote(host,room,'SCIENCE');
 perform public.outlier_party_theme_vote(guest,room,'SCIENCE');
 select public.outlier_party_state(host,room) into phase;
 if (phase->>'roundSeconds')::integer<>30 or
    (phase->>'seriesLength')::integer<>3 or
    jsonb_array_length(phase->'themeVotes')<>1 or
    (phase->'themeVotes'->0->>'votes')::integer<>2 then
   raise exception 'Room vote/settings mismatch: %',phase;end if;
 perform public.outlier_party_ready(host,room,true);
 perform public.outlier_party_ready(guest,room,true);
 perform public.outlier_party_configure(host,room,30,3);
 select count(*) into fail_name from public.outlier_party_members
   where room_id=room and ready; -- safe as text count
 if fail_name<>'0' then raise exception 'Config did not reset readiness';end if;
 perform public.outlier_party_ready(host,room,true);
 perform public.outlier_party_ready(guest,room,true);
 perform public.outlier_party_start(host,room);
 select public.outlier_party_state(host,room) into phase;
 if phase->>'phase'<>'countdown' then raise exception 'Expected shared countdown';end if;
 update public.outlier_party_rooms
   set starts_at=clock_timestamp()-interval '32 seconds' where id=room;
 select public.outlier_party_state(host,room) into phase;
 if phase->>'phase'<>'playing' or (phase->'question'->>'index')::integer<>1 then
   raise exception '30s server timer was not used: %',phase;end if;
 perform public.outlier_party_answer(host,room,1,'');
 update public.outlier_party_rooms
   set starts_at=clock_timestamp()-interval '212 seconds' where id=room;
 select public.outlier_party_state(host,room) into results;
 if results->>'phase'<>'finished' or
    (results->'series'->>'played')::integer<>1 then
   raise exception 'Not finished after 7x30s';end if;
 select public.outlier_party_vote_rematch(host,room) into payload;
 if (payload->>'ready')::boolean then raise exception 'Rematch needs guest vote';end if;
 select public.outlier_party_vote_rematch(guest,room) into payload;
 next_room:=(payload->>'roomId')::uuid;
 select public.outlier_party_state(host,next_room) into phase;
 if phase->>'phase'<>'waiting' or
   (phase->>'roundSeconds')::integer<>30 or
   (phase->>'seriesLength')::integer<>3 or
   (phase->>'seriesGame')::integer<>2 or
   jsonb_array_length(phase->'themeVotes')<>0
 then raise exception 'Rematch copied forbidden lobby state or lost config';end if;

 perform public.outlier_party_ready(host,next_room,true);
 perform public.outlier_party_ready(guest,next_room,true);
 perform public.outlier_party_start(host,next_room);
 update public.outlier_party_rooms
   set starts_at=clock_timestamp()-interval '212 seconds' where id=next_room;
 perform public.outlier_party_vote_rematch(host,next_room);
 select public.outlier_party_vote_rematch(guest,next_room) into payload;
 next2:=(payload->>'roomId')::uuid;
 if (select series_game from public.outlier_party_rooms where id=next2)<>3
 then raise exception 'Series game counter incorrect';end if;
 perform public.outlier_party_ready(host,next2,true);
 perform public.outlier_party_ready(guest,next2,true);
 perform public.outlier_party_start(host,next2);
 update public.outlier_party_rooms
   set starts_at=clock_timestamp()-interval '212 seconds' where id=next2;
 select public.outlier_party_state(host,next2) into results;
 if results->'rematch'->>'seriesComplete'<>'true' or
    (results->'series'->>'played')::integer<>3 or
    jsonb_array_length(results->'series'->'standings')<>2 then
   raise exception 'Series finished scoreboard missing: %',results;end if;
 begin
  perform public.outlier_party_vote_rematch(host,next2);
  raise exception 'Four-game series exceeded cap';
 exception when others then
  if sqlerrm='Four-game series exceeded cap' then raise;end if;
  if position('party_series_complete' in sqlerrm)=0 then raise;end if;
 end;
 select public.outlier_party_mastery(host) into payload;
 if (payload->>'games')::integer<3 or (payload->>'ties')::integer<3 then
  raise exception 'Private career stats failed to record completed series: %',payload;end if;
 if has_table_privilege('authenticated','public.outlier_party_theme_votes','SELECT')
    or has_function_privilege('authenticated','public.outlier_party_configure(uuid,uuid,integer,integer)','EXECUTE')
    or has_function_privilege('anon','public.outlier_party_mastery(uuid)','EXECUTE')
 then raise exception 'New private data or service RPC exposed to browsers';end if;
end $test_v110$;
