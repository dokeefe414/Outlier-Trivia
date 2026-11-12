-- OUTLIER v0.8 — retry unrecognized answers without using up a question.
-- No timer resets. Only an approved response, explicit skip, or timeout
-- finishes a round. Keep at most the most recent rejected guess per round.
create table if not exists private.outlier_rejected_guesses (
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid not null references public.game_attempts(id) on delete cascade,
  question_id text not null,
  last_guess text not null check (char_length(last_guess) between 1 and 100),
  guess_count integer not null default 1 check (guess_count>=1),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (attempt_id,question_id)
);
revoke all on private.outlier_rejected_guesses from public,anon,authenticated;

create or replace function public.outlier_answer(
  p_user uuid, p_game uuid, p_index integer, p_response text default null
) returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_game public.game_attempts%rowtype;
  v_q private.ranked_question_bank%rowtype;
  v_row jsonb;
  v_alias jsonb;
  v_label text := null;
  v_points integer := 0;
  v_share integer := null;
  v_max integer := 0;
  v_correct boolean := false;
  v_text text := left(coalesce(p_response,''),100);
  v_norm text := private.normalized_answer(left(coalesce(p_response,''),100));
  v_result jsonb;
  v_reveal jsonb;
  v_now timestamptz := clock_timestamp();
  v_candidate text := null;
  v_candidate_points integer := 0;
  v_near boolean := false;
  v_alias_text text;
begin
  select * into v_game from public.game_attempts where id=p_game and user_id=p_user for update;
  if not found then raise exception 'game_not_found'; end if;
  if v_game.completed_at is not null then raise exception 'game_already_finished'; end if;
  if v_game.next_index <> p_index then raise exception 'incorrect_question_index'; end if;
  if p_index not between 0 and 6 then raise exception 'invalid_question_index'; end if;
  if v_game.question_started_at is null then raise exception 'question_not_started'; end if;
  select * into v_q from private.ranked_question_bank where id=v_game.question_ids[p_index+1];
  if not found then raise exception 'question_not_found'; end if;

  -- The client cannot award extra points or extend a timer.
  if v_now <= v_game.question_started_at + interval '45 seconds' and length(v_norm)>0 then
    if v_q.kind='rare' then
      for v_row in select value from jsonb_array_elements(v_q.answers) loop
        if private.normalized_answer(v_row->>0) = v_norm then
          v_label := v_row->>0; v_points := (v_row->>1)::int; exit;
        end if;
        if jsonb_typeof(v_row->2)='array' then
          for v_alias in select value from jsonb_array_elements(v_row->2) loop
            if private.normalized_answer(v_alias #>> '{}') = v_norm then
              v_label := v_row->>0; v_points := (v_row->>1)::int; exit;
            end if;
          end loop;
        end if;
        if v_label is not null then exit; end if;
      end loop;
      -- Match a *single* one-character typo in answers of length 5+.
      -- More than one possible canonical answer means reject ambiguity.
      if v_label is null and length(v_norm)>=5 then
        for v_row in select value from jsonb_array_elements(v_q.answers) loop
          v_near:=private.outlier_one_typo(v_norm,private.normalized_answer(v_row->>0));
          if not v_near and jsonb_typeof(v_row->2)='array' then
            for v_alias in select value from jsonb_array_elements(v_row->2) loop
              v_alias_text:=v_alias #>> '{}';
              if private.outlier_one_typo(v_norm,private.normalized_answer(v_alias_text)) then
                v_near:=true; exit;
              end if;
            end loop;
          end if;
          if v_near then
            if v_candidate is not null and v_candidate<>v_row->>0 then
              v_candidate:=''; exit;
            end if;
            v_candidate:=v_row->>0;
            v_candidate_points:=(v_row->>1)::int;
          end if;
        end loop;
        if v_candidate is not null and v_candidate<>'' then
          v_label:=v_candidate;v_points:=v_candidate_points;
        end if;
      end if;
    else
      select max((value->>1)::int) into v_max from jsonb_array_elements(v_q.choices);
      for v_row in select value from jsonb_array_elements(v_q.choices) loop
        if private.normalized_answer(v_row->>0)=v_norm then
          v_label := v_row->>0;
          v_share := (v_row->>1)::int;
          v_points := round(v_share::numeric / greatest(v_max,1) * 1000)::int;
          exit;
        end if;
      end loop;
    end if;
  end if;
  -- A rejected typed answer within the active clock is NOT a round
  -- attempt. Keep the original deadline, question index, score and answers.
  -- Do not reveal the approved answer catalog until the round is finished.
  if v_label is null and p_response is not null
     and v_now <= v_game.question_started_at + interval '45 seconds' then
    if length(v_norm)>0 then
      insert into private.outlier_rejected_guesses
      (user_id,attempt_id,question_id,last_guess,guess_count,updated_at)
      values(p_user,p_game,v_q.id,v_text,1,v_now)
    on conflict(attempt_id,question_id) do update
      set last_guess=excluded.last_guess,
        guess_count=private.outlier_rejected_guesses.guess_count+1,
        updated_at=excluded.updated_at;
    end if;
    return jsonb_build_object('retry',true,'reason','answer_not_in_library',
      'state',public.outlier_state(p_user,p_game));
  end if;
  v_correct := v_label is not null;
  v_result := jsonb_build_object('questionId',v_q.id,'type',v_q.kind,'category',v_q.category,
    'accepted',v_label,'response',v_text,'points',v_points,'share',v_share,'valid',v_correct);
  if v_q.kind='fit' then
    select jsonb_agg(jsonb_build_object('name',value->>0,'share',(value->>1)::int)
      order by (value->>1)::int desc) into v_reveal
    from jsonb_array_elements(v_q.choices);
  else
    select jsonb_agg(jsonb_build_object('name',name,'points',points)
      order by points desc) into v_reveal
    from (select value->>0 as name,(value->>1)::int as points
      from jsonb_array_elements(v_q.answers) order by points desc limit 4) top;
  end if;
  update public.game_attempts set
    answers = v_game.answers || jsonb_build_array(v_result),
    score = v_game.score + v_points,
    next_index = v_game.next_index + 1,
    question_started_at = null,
    completed_at = case when p_index=6 then clock_timestamp() else null end
  where id=p_game;
  return jsonb_build_object('feedback',v_result,'reveal',v_reveal,'state',public.outlier_state(p_user,p_game));
end $$;

create or replace function public.outlier_review_submit(
  p_user uuid,p_attempt uuid,p_question text,p_reason text
) returns jsonb language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare
  v_game public.game_attempts%rowtype;
  v_response jsonb;
  v_reason text:=trim(left(coalesce(p_reason,''),500));
  v_id uuid;
begin
  if length(v_reason)<12 then raise exception 'review_reason_too_short'; end if;
  select * into v_game from public.game_attempts where id=p_attempt and user_id=p_user;
  if not found then raise exception 'game_not_found'; end if;
  -- Invalid retries do not consume the game round. Their last rejected
  -- guess is stored privately and can still be submitted for manual review.
  select jsonb_build_object('response',last_guess) into v_response
    from private.outlier_rejected_guesses
    where attempt_id=p_attempt and user_id=p_user and question_id=p_question
    limit 1;
  if v_response is null then raise exception 'review_requires_invalid_answer'; end if;
  if (select count(*) from public.answer_reviews
      where user_id=p_user and created_at>clock_timestamp()-interval '24 hours')>=4 then
    raise exception 'review_rate_limit';
  end if;
  insert into public.answer_reviews(user_id,attempt_id,question_id,submitted_answer,reason)
    values(p_user,p_attempt,p_question,v_response->>'response',v_reason)
    on conflict (user_id,attempt_id,question_id) do update
      set reason=excluded.reason
      where public.answer_reviews.status='pending'
    returning id into v_id;
  if v_id is null then raise exception 'review_already_processed'; end if;
  return jsonb_build_object('id',v_id,'status','pending');
end $$;

revoke all on function public.outlier_answer(uuid,uuid,integer,text)
  from public,anon,authenticated;
grant execute on function public.outlier_answer(uuid,uuid,integer,text) to service_role;
revoke all on function public.outlier_review_submit(uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.outlier_review_submit(uuid,uuid,text,text) to service_role;
