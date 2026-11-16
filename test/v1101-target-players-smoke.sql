-- OUTLIER v1.10.1: synthetic accounts in disposable CI only.
-- Verify exact room target, outsider/host isolation, consent and rematch size.
do $v1101$
declare
 host uuid:='b1111111-1111-4111-8111-111111111111';
 first uuid:='b2222222-2222-4222-8222-222222222222';
 second uuid:='b3333333-3333-4333-8333-333333333333';
 fourth uuid:='b4444444-4444-4444-8444-444444444444';
 room jsonb; room_id uuid; state jsonb; proposed jsonb; followup uuid;
begin
 insert into auth.users(id,email) values
  (host,'v1101-host@example.test'),(first,'v1101-guest1@example.test'),
  (second,'v1101-guest2@example.test'),(fourth,'v1101-guest3@example.test');
 room:=public.outlier_party_create(host);room_id:=(room->>'id')::uuid;
 select public.outlier_party_state(host,room_id) into state;
 if state->>'targetPlayers'<>'2' then raise exception 'Wrong default target';end if;
 perform public.outlier_party_target(host,room_id,3);
 perform public.outlier_party_join(first,room->>'code');
 perform public.outlier_party_ready(host,room_id,true);
 perform public.outlier_party_ready(first,room_id,true);
 begin
  perform public.outlier_party_start(host,room_id);
  raise exception 'Started below player target';
 exception when others then
  if sqlerrm='Started below player target'
     or position('party_need_target_players' in sqlerrm)=0 then raise;end if;
 end;
 perform public.outlier_party_join(second,room->>'code');
 begin
  perform public.outlier_party_join(fourth,room->>'code');
  raise exception 'Over capacity invite succeeded';
 exception when others then
  if sqlerrm='Over capacity invite succeeded'
    or position('party_room_full' in sqlerrm)=0 then raise;end if;
 end;
 begin
  perform public.outlier_party_target(first,room_id,4);
  raise exception 'Guest changed target';
 exception when others then
  if sqlerrm='Guest changed target'
    or position('party_host_only' in sqlerrm)=0 then raise;end if;
 end;
 begin
  perform public.outlier_party_target(host,room_id,2);
  raise exception 'Host shrank below joined roster';
 exception when others then
  if sqlerrm='Host shrank below joined roster'
    or position('party_target_below_roster' in sqlerrm)=0 then raise;end if;
 end;
 perform public.outlier_party_target(host,room_id,3);
 if exists(select 1 from public.outlier_party_members where room_id=room_id and ready)
 then raise exception 'Changing target must reset ready';end if;
 perform public.outlier_party_ready(host,room_id,true);
 perform public.outlier_party_ready(first,room_id,true);
 perform public.outlier_party_ready(second,room_id,true);
 select public.outlier_party_start(host,room_id) into state;
 if state->>'phase'<>'countdown' or state->>'targetPlayers'<>'3'
 then raise exception 'Started 3-person room incorrectly';end if;
 update public.outlier_party_rooms set starts_at=clock_timestamp()-interval '320 seconds'
 where id=room_id;
 select public.outlier_party_state(host,room_id) into state;
 if state->>'phase'<>'finished' then raise exception 'Room did not finish';end if;
 perform public.outlier_party_vote_rematch(host,room_id);
 perform public.outlier_party_vote_rematch(first,room_id);
 select public.outlier_party_vote_rematch(second,room_id) into proposed;
 followup:=(proposed->>'roomId')::uuid;
 select public.outlier_party_state(host,followup) into state;
 if state->>'targetPlayers'<>'3' or state->>'phase'<>'waiting'
    or jsonb_array_length(state->'players')<>3 then
   raise exception 'Rematch changed target roster: %',state;end if;
 if exists(select 1 from public.outlier_party_members where room_id=followup and ready)
 then raise exception 'Rematch inherited ready states';end if;
 if has_function_privilege('anon','public.outlier_party_target(uuid,uuid,integer)','EXECUTE')
    or has_function_privilege('authenticated','public.outlier_party_target(uuid,uuid,integer)','EXECUTE')
    or not has_function_privilege('service_role','public.outlier_party_target(uuid,uuid,integer)','EXECUTE')
 then raise exception 'Target RPC has unsafe permissions';end if;
end $v1101$;
