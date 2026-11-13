-- v1.1 member-only rivalries; no raw answers or uncompleted games exposed.
do $rivalry_smoke$
declare
 a uuid:='88888888-8888-4888-8888-888888888888';
 b uuid:='99999999-9999-4999-8999-999999999999';
 outsider uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 club jsonb;club_id uuid; result jsonb;today_utc date:=(clock_timestamp() at time zone 'UTC')::date;
begin
 insert into auth.users(id,email) values
   (a,'v11-rival1@example.test'),(b,'v11-rival2@example.test'),
   (outsider,'v11-outsider@example.test');
 club:=public.outlier_league_create(a,'Friendly Rivalries');
 club_id:=(club->>'id')::uuid;
 perform public.outlier_league_join(b,club->>'code');
 insert into public.game_attempts(user_id,mode,game_day,question_ids,
   answers,next_index,score,completed_at)
 values
 (a,'daily',today_utc-2,array['r1','r2','r3','r4','r5','r6','r7'],'[]'::jsonb,7,5400,clock_timestamp()),
 (b,'daily',today_utc-2,array['r1','r2','r3','r4','r5','r6','r7'],'[]'::jsonb,7,5100,clock_timestamp()),
 (a,'daily',today_utc-1,array['r1','r2','r3','r4','r5','r6','r7'],'[]'::jsonb,7,5700,clock_timestamp()),
 (b,'daily',today_utc-1,array['r1','r2','r3','r4','r5','r6','r7'],'[]'::jsonb,7,6000,clock_timestamp()),
 (a,'daily',today_utc,array['r1','r2','r3','r4','r5','r6','r7'],'[]'::jsonb,7,6900,clock_timestamp());
 result:=public.outlier_rivalry(a,club_id,b,14);
 if (result->>'matchedDays')::int<>2 or (result->>'yourWins')::int<>1
   or (result->>'opponentWins')::int<>1 or (result->>'ties')::int<>0 then
   raise exception 'mutual-completion rivalry count incorrect: %',result;
 end if;
 if (result->>'currentWinStreak')::int<>0 then
   raise exception 'most recent day was lost, win streak should be 0';
 end if;
 if jsonb_array_length(result->'days')<>2 then
   raise exception 'unmatched day leaked into rivalry';
 end if;
 if result::text ~* 'r1|answer|email|purchase' then
   raise exception 'rivalry response leaks private record fields';
 end if;
 result:=public.outlier_rivalry(b,club_id,a,14);
 if (result->>'currentWinStreak')::int<>1 then
   raise exception 'most recent win not reflected in streak';
 end if;
 begin
   perform public.outlier_rivalry(outsider,club_id,b,14);
   raise exception 'nonmember was able to access private rivalry';
 exception when others then
   if sqlerrm='nonmember was able to access private rivalry' then raise;end if;
   if position('not_a_league_member' in sqlerrm)=0 then raise;end if;
 end;
 begin
   perform public.outlier_rivalry(a,club_id,outsider,14);
   raise exception 'viewer was able to compare against outsider';
 exception when others then
   if sqlerrm='viewer was able to compare against outsider' then raise;end if;
   if position('not_a_league_member' in sqlerrm)=0 then raise;end if;
 end;
 begin
   perform public.outlier_rivalry(a,club_id,a,14);
   raise exception 'self rivalry was accepted';
 exception when others then
   if sqlerrm='self rivalry was accepted' then raise;end if;
   if position('invalid_rivalry_request' in sqlerrm)=0 then raise;end if;
 end;
 if has_function_privilege('authenticated',
   'public.outlier_rivalry(uuid,uuid,uuid,integer)','EXECUTE') then
   raise exception 'direct rivalry RPC exposed to authenticated users';
 end if;
 raise notice 'v1.1 member-only rivalry, symmetric win totals, unmatched day hiding, access denied smoke passed';
end $rivalry_smoke$;
