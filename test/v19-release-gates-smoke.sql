-- OUTLIER 1.9 release gate: a full four-member consent and rematch test.
-- All accounts and clocks are disposable within CI, never real beta users.
do $release_gate$
declare
  host uuid:='51515151-5151-4515-8515-515151515151';
  guest_a uuid:='52525252-5252-4525-8525-525252525252';
  guest_b uuid:='53535353-5353-4535-8535-535353535353';
  guest_c uuid:='54545454-5454-4545-8545-545454545454';
  outsider uuid:='55555555-5555-4555-8555-555555555555';
  lobby jsonb;
  room uuid;
  code text;
  current_state jsonb;
  vote jsonb;
  nextroom uuid;
  totals jsonb;
  original text[];
begin
  insert into auth.users(id,email) values
    (host,'gate-host@example.test'),
    (guest_a,'gate-a@example.test'),
    (guest_b,'gate-b@example.test'),
    (guest_c,'gate-c@example.test'),
    (outsider,'gate-outside@example.test');
  lobby:=public.outlier_party_create(host);
  room:=(lobby->>'id')::uuid;
  code:=lobby->>'code';
  perform public.outlier_party_join(guest_a,code);
  perform public.outlier_party_join(guest_b,code);
  perform public.outlier_party_join(guest_c,code);
  perform public.outlier_party_ready(host,room,true);
  perform public.outlier_party_ready(guest_a,room,true);
  perform public.outlier_party_ready(guest_b,room,true);
  -- Four-person matches must not start unless ALL four explicitly consent.
  begin
    perform public.outlier_party_start(host,room);
    raise exception 'four_member_consent_bypass';
  exception when others then
    if sqlerrm='four_member_consent_bypass' then raise;end if;
    if position('party_members_not_ready' in sqlerrm)=0 then raise;end if;
  end;
  perform public.outlier_party_ready(guest_c,room,true);
  current_state:=public.outlier_party_start(host,room);
  if current_state->>'phase'<>'countdown' then
    raise exception 'no shared countdown';
  end if;
  select question_ids into original
    from public.outlier_party_rooms where id=room;
  update public.outlier_party_rooms set starts_at=clock_timestamp()-interval '320 seconds'
    where id=room;
  current_state:=public.outlier_party_state(host,room);
  if current_state->>'phase'<>'finished' or
    jsonb_array_length(current_state->'scores')<>4 then
    raise exception 'four-player final result not sealed properly';
  end if;
  -- Nobody entered a correct answer; all four may tie at zero, which is NOT
  -- four wins and must not be incorrectly reported as separate victories.
  totals:=public.outlier_party_history(host,20);
  if jsonb_array_length(totals)<>1 or totals->0->>'outcome'<>'tie' then
    raise exception 'tied match did not score as a tie: %',totals;
  end if;
  if jsonb_array_length(public.outlier_party_history(outsider,20))<>0 then
    raise exception 'outsider discovered full room history';
  end if;
  if jsonb_array_length(public.outlier_party_season(outsider,'all'))<>0 then
    raise exception 'outsider discovered private season';
  end if;
  perform public.outlier_party_vote_rematch(host,room);
  perform public.outlier_party_vote_rematch(guest_a,room);
  vote:=public.outlier_party_vote_rematch(guest_b,room);
  if (vote->>'ready')::boolean or vote->>'roomId' is not null and
    vote->>'roomId'<>'null' then
    raise exception 'rematch opened before the fourth player consented';
  end if;
  begin
    perform public.outlier_party_vote_rematch(outsider,room);
    raise exception 'outsider_forged_rematch';
  exception when others then
    if sqlerrm='outsider_forged_rematch' then raise;end if;
    if position('party_not_a_member' in sqlerrm)=0 then raise;end if;
  end;
  vote:=public.outlier_party_vote_rematch(guest_c,room);
  if vote->>'ready'<>'true' then raise exception 'unanimous rematch not created';end if;
  nextroom:=(vote->>'roomId')::uuid;
  if nextroom=room or nextroom is null then raise exception 'rematch reused old room';end if;
  current_state:=public.outlier_party_state(host,nextroom);
  if current_state->>'phase'<>'waiting' or
    jsonb_array_length(current_state->'players')<>4 then
    raise exception 'rematch did not preserve all invited consenters';
  end if;
  if (select count(*) from public.outlier_party_members
    where room_id=nextroom and ready)<>0 then
    raise exception 'rematch unlawfully inherited ready-up state';
  end if;
  if (select cardinality(question_ids) from public.outlier_party_rooms
    where id=nextroom)<>0 then
    raise exception 'rematch leaked old question slate';
  end if;
  if (select count(*) from private.outlier_party_answers
    where room_id=nextroom)<>0 then
    raise exception 'rematch copied previous answers';
  end if;
  if public.outlier_party_vote_rematch(host,room)->>'roomId'<>nextroom::text then
    raise exception 'duplicate vote created another room';
  end if;
  raise notice 'Four-member consent, all-tie classification, privacy and rematch integrity PASS';
end $release_gate$;
