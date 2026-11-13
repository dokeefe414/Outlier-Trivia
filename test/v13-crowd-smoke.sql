-- v1.3 privacy regression: 29 responses hidden, 30 visible, withdrawal
-- suppresses historical responses again. Disposable CI schema only.
do $v13_crowd$
declare
  v_i integer;
  v_user uuid;
  v_reader uuid:='00000000-0000-4000-8000-000000000001';
  v_result jsonb;
  v_today date:=(clock_timestamp() at time zone 'UTC')::date;
begin
  for v_i in 1..31 loop
    v_user:=('00000000-0000-4000-8000-'||lpad(v_i::text,12,'0'))::uuid;
    insert into auth.users(id,email) values(v_user,'v13-'||v_i||'@example.test');
    if v_i<=30 then
      update public.profiles set crowd_opted_at=clock_timestamp()-interval '5 days'
      where user_id=v_user;
    end if;
    insert into public.game_attempts(
      user_id,mode,game_day,question_ids,answers,next_index,score,completed_at
    ) values (
      v_user,'daily',v_today-2,
      array['v13-q1','v13-q2','v13-q3','v13-q4','v13-q5','v13-q6','v13-q7'],
      jsonb_build_array(jsonb_build_object(
        'questionId','fit-v13-ci','type','fit',
        'accepted',case when v_i%2=0 then 'Coffee' else 'Tea' end,
        'points',600,'valid',true),
      jsonb_build_object('questionId','rare-v13-ci','type','rare',
        'accepted','Monaco','points',800,'valid',true)),
      7,1400,clock_timestamp()-interval '2 days'
    );
    if v_i=29 then
      v_result:=public.outlier_crowd_pulse(v_reader,'fit-v13-ci');
      if v_result->>'available'<>'false' or v_result ? 'sampleSize' then
        raise exception '29 respondents leaked information: %',v_result;
      end if;
      v_result:=public.outlier_past_answer_rarity('rare-v13-ci');
      if v_result->>'available'<>'false' then
        raise exception '29 rare responses were disclosed';
      end if;
    end if;
  end loop;
  v_result:=public.outlier_crowd_pulse(v_reader,'fit-v13-ci');
  if v_result->>'available'<>'true' or (v_result->>'sampleSize')::int<>30
    or jsonb_array_length(v_result->'answers')<>2 then
    raise exception 'expected 30 opt-in answers, got %',v_result;
  end if;
  v_result:=public.outlier_past_answer_rarity('rare-v13-ci');
  if v_result->>'available'<>'true' or (v_result->>'sampleSize')::int<>30 then
    raise exception 'rare comparison must honor opt-in after 30 responses';
  end if;
  if public.outlier_crowd_pulse(v_reader,'not-played')->>'available'<>'false' then
    raise exception 'unplayed private question exposed';
  end if;
  if public.outlier_crowd_consent(
    '00000000-0000-4000-8000-000000000002'::uuid,false)<>false then
    raise exception 'withdrawal failed';
  end if;
  v_result:=public.outlier_crowd_pulse(v_reader,'fit-v13-ci');
  if v_result->>'available'<>'false' then
    raise exception 'withdrawal did not suppress historical aggregate';
  end if;
  if public.outlier_past_answer_rarity('rare-v13-ci')->>'available'<>'false' then
    raise exception 'withdrawal did not suppress rare response history';
  end if;
  perform public.outlier_crowd_consent(
    '00000000-0000-4000-8000-000000000002'::uuid,true);
  v_result:=public.outlier_crowd_pulse(v_reader,'fit-v13-ci');
  if v_result->>'available'<>'false' then
    raise exception 're-consent improperly exposed earlier answers';
  end if;
  if has_function_privilege('authenticated',
       'public.outlier_crowd_pulse(uuid,text)','EXECUTE')
    or has_function_privilege('authenticated',
       'public.outlier_crowd_consent(uuid,boolean)','EXECUTE')
    or has_function_privilege('authenticated',
       'public.outlier_past_answer_rarity(text)','EXECUTE') then
    raise exception 'untrusted role can invoke privileged crowd RPC';
  end if;
  raise notice 'v1.3 consent, opt-out, frozen prior-day samples, and 30-response threshold passed';
end $v13_crowd$;
