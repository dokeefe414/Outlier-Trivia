-- v0.8 retry-in-place, accepted answer and timeout integration smoke.
-- Runs after the disposable ranked fixture has been populated.
do $retry$
declare
 u uuid:='55555555-5555-4555-8555-555555555555';
 expired_user uuid:='66666666-6666-4666-8666-666666666666';
 g uuid; g2 uuid; q text; response text; result jsonb; st jsonb;
 initial_start timestamptz; updated_start timestamptz; report jsonb;
begin
 insert into auth.users(id,email) values
   (u,'retry-user@example.test'),(expired_user,'retry-timeout@example.test');
 g:=public.outlier_start(u,'daily');
 st:=public.outlier_state(u,g);
 q:=st->'question'->>'id';
 select question_started_at into initial_start from public.game_attempts where id=g;
 result:=public.outlier_answer(u,g,0,'thatcannotpossiblybeinthevalidlibrary987');
 if result->>'retry'<>'true' then raise exception 'invalid free text completed the round'; end if;
 if result ? 'reveal' or result ? 'feedback' then
   raise exception 'invalid guess leaked answers or feedback';
 end if;
 if result->'state'->>'index'<>'0' then
   raise exception 'invalid guess moved to next round'; end if;
 if (result->'state'->>'score')::integer<>0 then
   raise exception 'invalid guess changed the score'; end if;
 select question_started_at into updated_start from public.game_attempts where id=g;
 if updated_start is distinct from initial_start then
   raise exception 'invalid guess restarted the clock'; end if;
 if (select jsonb_array_length(answers) from public.game_attempts where id=g)<>0 then
   raise exception 'invalid guess was recorded as a scored answer'; end if;
 result:=public.outlier_answer(u,g,0,'a-second-unapproved-answer987');
 if result->>'retry'<>'true' then raise exception 'second retry was rejected'; end if;
 if (select guess_count from private.outlier_rejected_guesses where attempt_id=g and question_id=q)<>2 then
   raise exception 'private rejected-guess count not updated'; end if;
 result:=public.outlier_answer(u,g,0,'   ');
 if result->>'retry'<>'true' then raise exception 'blank typed answer should be retryable'; end if;
 report:=public.outlier_review_submit(u,g,q,
   'The rejected response should be reviewed against a reliable public source.');
 if report->>'status'<>'pending' then raise exception 'review of unscored rejection failed'; end if;
 if (select count(*) from public.answer_reviews where user_id=u and attempt_id=g)<>1 then
   raise exception 'rejected guess review ticket missing'; end if;

 select case when kind='rare' then answers->0->>0 else choices->0->>0 end
   into response from private.ranked_question_bank where id=q;
 result:=public.outlier_answer(u,g,0,response);
 if result ? 'retry' then raise exception 'valid answer treated as retry'; end if;
 if (result->'feedback'->>'points')::integer<=0 then
   raise exception 'valid library answer should earn points'; end if;
 if (result->'state'->>'index'<>'1' then
   raise exception 'valid library answer did not finalize round'; end if;
 if (select jsonb_array_length(answers) from public.game_attempts where id=g)<>1 then
   raise exception 'valid answer not recorded exactly once'; end if;

 st:=public.outlier_advance(u,g,1);
 if st->>'index'<>'1' then raise exception 'advance failed after a correct answer'; end if;
 result:=public.outlier_answer(u,g,1,null);
 if result->>'retry' is not null or result->'feedback'->>'valid'<>'false' then
   raise exception 'explicit skip should finalize without points'; end if;
 if result->'state'->>'index'<>'2' then raise exception 'skip did not move round forward'; end if;

 g2:=public.outlier_start(expired_user,'daily');
 update public.game_attempts
   set question_started_at=clock_timestamp()-interval '46 seconds' where id=g2;
 result:=public.outlier_answer(expired_user,g2,0,'too-late-invalid-answer');
 if result ? 'retry' then raise exception 'expired invalid answer should not keep retrying'; end if;
 if result->'feedback'->>'valid'<>'false' then
   raise exception 'expired answer wrongly counted'; end if;
 if result->'state'->>'index'<>'1' then
   raise exception 'timed-out round was not finalized'; end if;
 if has_table_privilege('authenticated','private.outlier_rejected_guesses','SELECT') then
   raise exception 'private rejected text exposed to signed-in users'; end if;
 raise notice 'v0.8 invalid guesses stay put, timer persists, review works, valid/skip/timeout finish the round';
end $retry$;
