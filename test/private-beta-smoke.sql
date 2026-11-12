-- v0.7 end-to-end SQL smoke, after private test-only content is seeded.
do $v07$
declare
 u uuid:='44444444-4444-4444-8444-444444444444';
 g uuid; st jsonb; ans jsonb; qid text; response text;
 i integer; r jsonb; current_week date;
 ids text[]:=array[]::text[];
 today_ids text[];
 total_count integer;
begin
 insert into auth.users(id,email) values (u,'private-content-test@example.test');
 r:=public.outlier_launch_readiness();
 if r->>'ready'<>'true' then raise exception 'ranked bank should be ready in CI: %',r; end if;
 if (select count(*) from private.ranked_question_bank)<100 then
   raise exception 'ranked seed unexpectedly small';
 end if;
 if has_table_privilege('anon','private.ranked_question_bank','SELECT') then
   raise exception 'anonymous players can read private answers';
 end if;
 if has_table_privilege('authenticated','private.ranked_question_bank','SELECT') then
   raise exception 'authenticated players can read private answers';
 end if;
 current_week:=date_trunc('week',clock_timestamp() at time zone 'UTC')::date;
 for i in 0..6 loop
   today_ids:=private.outlier_preview_daily_ids(current_week+i);
   ids:=ids||today_ids;
 end loop;
 select count(distinct id)::int into total_count from unnest(ids) t(id);
 if total_count<>49 then raise exception 'ranked 7-day schedule repeats prompts: %',total_count; end if;

 g:=public.outlier_start(u,'daily');
 if public.outlier_start(u,'daily')<>g then raise exception 'duplicate ranked daily'; end if;
 st:=public.outlier_state(u,g);
 if st->'question' ? 'answers' or st->'question' ? 'scoring' then
   raise exception 'question state leaked ranked scoring keys';
 end if;
 if st->'question'->>'id' not like 'rk_%' then
   raise exception 'official game did not use private ranked questions';
 end if;
 for i in 0..6 loop
   qid:=st->'question'->>'id';
   select case when kind='rare' then answers->0->>0 else choices->0->>0 end
    into response from private.ranked_question_bank where id=qid;
   if response is null then raise exception 'missing private answer %',qid; end if;
   ans:=public.outlier_answer(u,g,i,response);
   if (ans->'feedback'->>'points')::int<=0 then
     raise exception 'private bank answer failed server scoring %',qid; end if;
   st:=ans->'state';
   if i<6 then st:=public.outlier_advance(u,g,i+1); end if;
 end loop;
 if st->>'complete'<>'true' then raise exception 'ranked game not completed'; end if;
 if (st->>'score')::int<=0 then raise exception 'ranked score missing'; end if;

 if not public.outlier_request_budget(u,'name',2,3600) then raise exception 'budget first call';end if;
 if not public.outlier_request_budget(u,'name',2,3600) then raise exception 'budget second call';end if;
 if public.outlier_request_budget(u,'name',2,3600) then raise exception 'budget exceeded but still allowed';end if;
 if has_function_privilege('authenticated',
      'public.outlier_request_budget(uuid,text,integer,integer)','EXECUTE') then
   raise exception 'authenticated client can bypass server request budget';
 end if;
 r:=public.outlier_beta_metrics();
 if (r->>'completedDailies')::int<2 then raise exception 'beta completion report missing';end if;
 if (r->>'uniquePlayers')::int<2 then raise exception 'beta unique-player count missing';end if;
 raise notice 'v0.7 ranked security, full-game scoring, budgets, readiness, beta metrics smoke passed';
end $v07$;

do $billing$
declare
 u uuid:='44444444-4444-4444-8444-444444444444';
 r jsonb;
begin
 r:=public.outlier_apply_billing_event('evt_testpaid01','paid',u,
   'cs_test_good01','pi_test_good01',499,'usd');
 if r->>'duplicate'<>'false' then raise exception 'payment not recorded';end if;
 if not (select unlimited from public.entitlements where user_id=u) then
   raise exception 'payment failed to unlock premium';end if;
 r:=public.outlier_apply_billing_event('evt_testpaid01','paid',u,
   'cs_test_good01','pi_test_good01',499,'usd');
 if r->>'duplicate'<>'true' then raise exception 'idempotent replay not handled';end if;
 perform public.outlier_apply_billing_event('evt_testpartial','refunded',null,null,'pi_test_good01',100,'usd');
 if not (select unlimited from public.entitlements where user_id=u) then
   raise exception 'partial refund incorrectly revoked purchase';end if;
 perform public.outlier_apply_billing_event('evt_testfullrefund','refunded',null,null,'pi_test_good01',499,'usd');
 if (select unlimited from public.entitlements where user_id=u) then
   raise exception 'full refund did not revoke premium';end if;
 perform public.outlier_apply_billing_event('evt_latepaid','paid',u,
   'cs_test_good01','pi_test_good01',499,'usd');
 if (select unlimited from public.entitlements where user_id=u) then
   raise exception 'out-of-order payment event re-granted refunded purchase';end if;
 perform public.outlier_apply_billing_event('evt_secondpurchase','paid',u,
   'cs_test_good02','pi_test_good02',499,'usd');
 if not (select unlimited from public.entitlements where user_id=u) then
   raise exception 'a new valid purchase could not restore access';end if;
 perform public.outlier_apply_billing_event('evt_olddispute','disputed',null,null,'pi_test_good01',499,'usd');
 if not (select unlimited from public.entitlements where user_id=u) then
   raise exception 'old payment dispute revoked a different valid purchase';end if;
 perform public.outlier_apply_billing_event('evt_newdispute','disputed',null,null,'pi_test_good02',499,'usd');
 if (select unlimited from public.entitlements where user_id=u) then
   raise exception 'current purchase dispute did not revoke access';end if;
 if has_function_privilege('authenticated',
     'public.outlier_apply_billing_event(text,text,uuid,text,text,integer,text)','EXECUTE') then
   raise exception 'authenticated user can modify billing';end if;
 raise notice 'v0.7 Stripe payment, duplicate, partial/full refund, reordering and dispute smoke passed';
end $billing$;
