-- Disposable CI-only multiplayer security smoke.
-- Requires migrations through v1.7 and the private ranked *test fixture*.
do $test_party$
declare
  u1 uuid:='11111111-1111-4111-8111-111111111111';
  u2 uuid:='22222222-2222-4222-8222-222222222222';
  u3 uuid:='33333333-3333-4333-8333-333333333333';
  lobby jsonb;
  room uuid;
  code text;
  joined jsonb;
  frame jsonb;
  submitted jsonb;
  qid text;
  answer text;
  final jsonb;
begin
  if public.outlier_request_budget(u1,'party-answer',30,3600)<>true then
    raise exception 'Rate budget rejected legitimate private-room action';
  end if;
  lobby:=public.outlier_party_create(u1);
  room:=(lobby->>'id')::uuid;
  code:=lobby->>'code';
  if length(code)<>12 then raise exception 'Room code not generated';end if;
  if (select count(*) from public.outlier_party_members where room_id=room)<>1 then
    raise exception 'Host membership not inserted';
  end if;
  frame:=public.outlier_party_state(u1,room);
  if frame->>'phase'<>'waiting' or frame->>'question'<>'null' then
    raise exception 'Waiting state leaked a question';
  end if;
  begin
    perform public.outlier_party_start(u2,room);
    raise exception 'Non-host started room';
  exception when others then
    if sqlerrm='Non-host started room' then raise;end if;
    if position('party_host_only' in sqlerrm)=0 then raise;end if;
  end;
  begin
    perform public.outlier_party_state(u3,room);
    raise exception 'Outsider saw private room';
  exception when others then
    if sqlerrm='Outsider saw private room' then raise;end if;
    if position('party_not_a_member' in sqlerrm)=0 then raise;end if;
  end;
  joined:=public.outlier_party_join(u2,code);
  if joined->>'alreadyMember'<>'false' then raise exception 'Guest cannot join';end if;
  if public.outlier_party_join(u2,code)->>'alreadyMember'<>'true' then
    raise exception 'Duplicate member not idempotent';
  end if;
  frame:=public.outlier_party_start(u1,room);
  if frame->>'phase'<>'countdown' or jsonb_array_length(frame->'players')<>2 then
    raise exception 'Two-player lobby did not synchronize countdown: %',frame;
  end if;
  if (select count(*) from unnest((select question_ids from public.outlier_party_rooms
      where id=room)) q(id) where exists(
        select 1 from private.official_daily_slates s where q.id=any(s.question_ids)))>0 then
    raise exception 'Room leaked an already published official daily question';
  end if;
  begin
    perform public.outlier_party_join(u3,code);
    raise exception 'Late join allowed';
  exception when others then
    if sqlerrm='Late join allowed' then raise;end if;
    if position('party_room_unavailable' in sqlerrm)=0 then raise;end if;
  end;
  -- Shift server-clock start only in disposable smoke to avoid CI wall-time waits.
  update public.outlier_party_rooms set starts_at=clock_timestamp()-interval '5 seconds'
    where id=room;
  frame:=public.outlier_party_state(u1,room);
  if frame->>'phase'<>'playing' or frame->'question'->>'index'<>'0' then
    raise exception 'Room did not start round zero';
  end if;
  if frame->'scores'<>'null'::jsonb or frame->'answers'<>'null'::jsonb then
    raise exception 'Pre-finish scores or secrets leaked';
  end if;
  select question_ids[1] into qid from public.outlier_party_rooms where id=room;
  select answers->0->>0 into answer from private.ranked_question_bank where id=qid;
  if answer is null then raise exception 'Expected first room question to be rare';end if;
  submitted:=public.outlier_party_answer(u1,room,0,answer);
  if submitted->>'locked'<>'true' or submitted ? 'points' or submitted ? 'accepted' then
    raise exception 'Answer endpoint leaked private scoring details';
  end if;
  if public.outlier_party_state(u1,room)->'question'->>'submitted'<>'true' then
    raise exception 'Answer did not lock for the submitting player';
  end if;
  if public.outlier_party_state(u2,room)->'question'->>'submitted'<>'false' then
    raise exception 'Other player incorrectly shown as answered';
  end if;
  begin
    perform public.outlier_party_answer(u1,room,0,answer);
    raise exception 'Repeat answer permitted';
  exception when others then
    if sqlerrm='Repeat answer permitted' then raise;end if;
    if position('party_already_answered' in sqlerrm)=0 then raise;end if;
  end;
  perform public.outlier_party_answer(u2,room,0,'clearly-not-correct');
  update public.outlier_party_rooms set starts_at=clock_timestamp()-interval '320 seconds'
    where id=room;
  final:=public.outlier_party_state(u1,room);
  if final->>'phase'<>'finished' or jsonb_array_length(final->'scores')<>2 then
    raise exception 'Final verified scoreboard missing';
  end if;
  if final->'question'<>'null'::jsonb then
    raise exception 'Finished game still leaked a live question';
  end if;
  if (select max((member->>'score')::int) from jsonb_array_elements(final->'scores') member)<=0 then
    raise exception 'Verified correct answer was not scored';
  end if;
  if (select count(*) from jsonb_array_elements(final->'answers'))<>2 then
    raise exception 'Final reveal missed answer records';
  end if;
  if has_function_privilege('authenticated',
    'public.outlier_party_answer(uuid,uuid,integer,text)','EXECUTE') then
    raise exception 'Authenticated browser can call private room scoring directly';
  end if;
  if has_table_privilege('authenticated','private.outlier_party_answers','SELECT') then
    raise exception 'Private answer table exposed';
  end if;
  if has_table_privilege('anon','public.outlier_party_members','SELECT') then
    raise exception 'Private room roster exposed';
  end if;
  raise notice 'v1.7 private rooms: membership, timers, secrecy, scores and privilege gates PASS';
end $test_party$;
