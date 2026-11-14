-- OUTLIER v1.8 disposable PostgreSQL 4-client capacity/reconnect smoke.
-- No real accounts, email delivery, or production rooms are created.
do $v18_room_scale$
declare
  host uuid:='80808080-8080-4808-8808-808080808081';
  a uuid:='80808080-8080-4808-8808-808080808082';
  b uuid:='80808080-8080-4808-8808-808080808083';
  c uuid:='80808080-8080-4808-8808-808080808084';
  outsider uuid:='80808080-8080-4808-8808-808080808085';
  lobby jsonb;
  room_id uuid;
  code text;
  initial jsonb;
  live jsonb;
  final jsonb;
  first_answer text;
  first_id text;
begin
  insert into auth.users(id,email) values
    (host,'v18-host@example.test'),
    (a,'v18-guest-a@example.test'),
    (b,'v18-guest-b@example.test'),
    (c,'v18-guest-c@example.test'),
    (outsider,'v18-outsider@example.test');
  lobby:=public.outlier_party_create(host);
  room_id:=(lobby->>'id')::uuid;
  code:=lobby->>'code';
  perform public.outlier_party_join(a,code);
  perform public.outlier_party_join(b,code);
  perform public.outlier_party_join(c,code);
  initial:=public.outlier_party_state(host,room_id);
  if jsonb_array_length(initial->'players')<>4 or
    initial->>'phase'<>'waiting' then
    raise exception 'Four distinct members were not admitted';
  end if;
  begin
    perform public.outlier_party_join(outsider,code);
    raise exception 'Fifth player unexpectedly admitted';
  exception when others then
    if sqlerrm='Fifth player unexpectedly admitted' then raise;end if;
    if position('party_room_full' in sqlerrm)=0 then raise;end if;
  end;
  perform public.outlier_party_start(host,room_id);
  live:=public.outlier_party_state(c,room_id);
  if live->>'phase'<>'countdown' or live->'scores'<>'null'::jsonb then
    raise exception 'Four-player countdown leaked score details';
  end if;
  update public.outlier_party_rooms set starts_at=clock_timestamp()-interval '2 seconds'
    where id=room_id;
  select question_ids[1] into first_id
    from public.outlier_party_rooms where id=room_id;
  select answers->0->>0 into first_answer
    from private.outlier_party_question_bank where id=first_id;
  perform public.outlier_party_answer(host,room_id,0,first_answer);
  perform public.outlier_party_answer(a,room_id,0,null);
  perform public.outlier_party_answer(b,room_id,0,null);
  perform public.outlier_party_answer(c,room_id,0,null);
  -- A reconnect is simply a fresh authorized state request. It may not
  -- mutate the old answer, expose anyone else's score, or extend round 1.
  live:=public.outlier_party_state(host,room_id);
  if live->'question'->>'submitted'<>'true' or
    live->'scores'<>'null'::jsonb or
    live->'answers'<>'null'::jsonb then
    raise exception 'Reconnect changed sealed live results';
  end if;
  live:=public.outlier_party_state(a,room_id);
  if live->'question'->>'submitted'<>'true' then
    raise exception 'Participant did not retain server lock on reconnect';
  end if;
  begin
    perform public.outlier_party_state(outsider,room_id);
    raise exception 'Outsider inspected a full private room';
  exception when others then
    if sqlerrm='Outsider inspected a full private room' then raise;end if;
    if position('party_not_a_member' in sqlerrm)=0 then raise;end if;
  end;
  update public.outlier_party_rooms set starts_at=clock_timestamp()-interval '316 seconds'
    where id=room_id;
  final:=public.outlier_party_state(host,room_id);
  if final->>'phase'<>'finished' or
    jsonb_array_length(final->'scores')<>4 or
    jsonb_array_length(final->'answers')<>4 or
    jsonb_array_length(final->'questions')<>7 then
    raise exception 'Four-player synchronized final reveal failed: %',final;
  end if;
  if (select max((row->>'score')::integer)
      from jsonb_array_elements(final->'scores') row)<=0 then
    raise exception 'Server did not credit a valid submitted rare answer';
  end if;
  -- An abandoned waiting room is unusable even if the invite is shared.
  lobby:=public.outlier_party_create(host);
  update public.outlier_party_rooms set expires_at=clock_timestamp()-interval '1 second'
    where id=(lobby->>'id')::uuid;
  begin
    perform public.outlier_party_join(outsider,lobby->>'code');
    raise exception 'Expired waiting invite allowed entry';
  exception when others then
    if sqlerrm='Expired waiting invite allowed entry' then raise;end if;
    if position('party_room_unavailable' in sqlerrm)=0 then raise;end if;
  end;
  raise notice 'v1.8 four-player capacity, sealed reconnect, expire, and server-results PASS';
end $v18_room_scale$;
