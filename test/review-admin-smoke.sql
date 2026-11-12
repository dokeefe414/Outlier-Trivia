-- v0.9 editorial review workflow and privacy smoke.
-- Uses test/retry-invalid-smoke.sql's existing legitimate rejected guess.
do $editorial$
declare
  v_ticket uuid;
  v_owner uuid;
  v_before integer;
  v_after integer;
  v_decision jsonb;
  v_queue jsonb;
  v_mine jsonb;
  v_counts jsonb;
begin
  select id,user_id into v_ticket,v_owner
    from public.answer_reviews where status='pending'
    order by created_at desc limit 1;
  if v_ticket is null then raise exception 'no rejected-answer ticket found for review'; end if;
  v_queue:=public.outlier_admin_review_queue('pending',50);
  if jsonb_array_length(v_queue)<1 then raise exception 'admin inbox cannot see pending tickets'; end if;
  v_mine:=public.outlier_review_my_tickets(v_owner,20);
  if jsonb_array_length(v_mine)<1 then raise exception 'player cannot see their own review status';end if;
  if exists(select 1 from public.answer_reviews where user_id<>v_owner
     and id=(v_mine->0->>'id')::uuid) then raise exception 'player review leaked another user'; end if;
  select count(*)::integer into v_before from private.ranked_question_bank;
  v_decision:=public.outlier_admin_review_decide(v_ticket,'needs_more_info',
    'Please provide a published reference confirming this alternate name.');
  if v_decision->>'status'<>'needs_more_info' then raise exception 'review decision failed'; end if;
  v_decision:=public.outlier_admin_review_decide(v_ticket,'approved',
    'Editorially verified suggestion for a future versioned question only.');
  if v_decision->>'status'<>'approved' or v_decision->>'appliedToQuestionBank'<>'false'
     or v_decision->>'retroactiveScoreChange'<>'false' then
    raise exception 'approved suggestion incorrectly altered published scoring';end if;
  if (select count(*) from private.answer_review_audit where review_id=v_ticket)<>2 then
    raise exception 'review decision audit trail is incomplete'; end if;
  select count(*)::integer into v_after from private.ranked_question_bank;
  if v_before<>v_after then raise exception 'review decision wrote ranked question content'; end if;
  begin
    perform public.outlier_admin_review_decide(v_ticket,'rejected',
      'An already finalized decision must not be overwritten by another action.');
    raise exception 'an approved ticket was modified again';
  exception when others then
    if sqlerrm='an approved ticket was modified again' then raise; end if;
    if position('review_already_processed' in sqlerrm)=0 then raise;end if;
  end;
  v_counts:=public.outlier_admin_review_counts();
  if (v_counts->>'approved')::integer<1 then raise exception 'review counts not updated'; end if;
  if has_function_privilege('authenticated',
      'public.outlier_admin_review_queue(text,integer)','EXECUTE') then
    raise exception 'signed-in player has direct access to admin inbox';end if;
  if has_function_privilege('authenticated',
      'public.outlier_admin_review_decide(uuid,text,text)','EXECUTE') then
    raise exception 'signed-in player can make admin decisions';end if;
  if has_function_privilege('anon',
      'public.outlier_admin_review_queue(text,integer)','EXECUTE') then
    raise exception 'anonymous viewer can read admin review queue';end if;
  raise notice 'v0.9 manual review queue, ownership, status transitions, audit and score immutability passed';
end $editorial$;
