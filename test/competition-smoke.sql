-- OUTLIER competition v0.6 PostgreSQL integration test.
-- Run ONLY after disposable test database bootstrap, migrations and base smoke.
do $community_test$
declare
  u1 uuid:='11111111-1111-4111-8111-111111111111';
  u2 uuid:='22222222-2222-4222-8222-222222222222';
  u3 uuid:='33333333-3333-4333-8333-333333333333';
  club jsonb;
  club_id uuid;
  code text;
  game_id uuid;
  feedback jsonb;
  state jsonb;
  ticket jsonb;
  roster jsonb;
  records jsonb;
  history jsonb;
  i integer;
  uid uuid;
begin
  insert into auth.users(id,email) values
    (u2,'community2@example.test'),(u3,'community3@example.test');
  club:=public.outlier_league_create(u1,'Trivia Besties');
  club_id:=(club->>'id')::uuid;
  code:=club->>'code';
  if length(code)<>12 then raise exception 'invite code length incorrect'; end if;
  if (select count(*) from public.friend_league_members where league_id=club_id)<>1
    then raise exception 'owner was not added as a member'; end if;
  if (public.outlier_league_join(u2,code)->>'alreadyMember')<>'false'
    then raise exception 'second member could not join'; end if;
  if (public.outlier_league_join(u2,code)->>'alreadyMember')<>'true'
    then raise exception 'joining twice should be idempotent'; end if;
  if jsonb_array_length(public.outlier_league_list(u2))<>1 then raise exception 'joined league missing'; end if;
  if jsonb_array_length(public.outlier_league_list(u3))<>0 then raise exception 'private membership leaked'; end if;
  begin
    perform public.outlier_league_standings(u3,club_id,'week');
    raise exception 'outsider could see friend rankings';
  exception when others then
    if sqlerrm='outsider could see friend rankings' then raise;end if;
    if position('not_a_league_member' in sqlerrm)=0 then raise;end if;
  end;
  roster:=public.outlier_league_standings(u1,club_id,'all');
  if jsonb_array_length(roster)<>2 then raise exception 'missing league players'; end if;
  if jsonb_array_length(public.outlier_weekly_leaderboard(50))<1
    then raise exception 'weekly leaderboard missing completed players'; end if;
  history:=public.outlier_player_history(u1,35);
  if jsonb_array_length(history)<1 then raise exception 'official player history missing'; end if;
  if (history->0->>'score')::integer<=0 then raise exception 'historical score not returned'; end if;
  if has_function_privilege('authenticated','public.outlier_league_list(uuid)','EXECUTE')
    then raise exception 'direct authenticated league RPC is exposed'; end if;
  if has_table_privilege('authenticated','public.friend_league_members','INSERT')
    then raise exception 'direct membership writes are exposed'; end if;
  if not private.outlier_one_typo('giraffee','giraffe')
    then raise exception 'one-edit typo matcher failed'; end if;
  if private.outlier_one_typo('cat','dog')
    then raise exception 'unrelated answers should never match'; end if;

  game_id:=public.outlier_start(u2,'daily');
  state:=public.outlier_state(u2,game_id);
  feedback:=public.outlier_answer(u2,game_id,0,'clearlynotavalidanswer000000');
  if feedback->'feedback'->>'valid'<>'false' then raise exception 'invalid answer wrongly accepted'; end if;
  if feedback->'feedback'->>'response'<>'clearlynotavalidanswer000000'
    then raise exception 'rejected answer was not recorded for review'; end if;
  ticket:=public.outlier_review_submit(u2,game_id,feedback->'feedback'->>'questionId',
    'My suggestion should be reviewed against an authoritative reference.');
  if ticket->>'status'<>'pending' then raise exception 'review was not recorded'; end if;
  if (select count(*) from public.answer_reviews where user_id=u2)<>1
    then raise exception 'review was not stored'; end if;
  begin
    perform public.outlier_review_submit(u3,game_id,feedback->'feedback'->>'questionId',
      'Trying to submit another player''s invalid answer review.');
    raise exception 'review access was not checked';
  exception when others then
    if sqlerrm='review access was not checked' then raise;end if;
    if position('game_not_found' in sqlerrm)=0 then raise;end if;
  end;

  records:=public.outlier_past_answer_rarity('atlas-geo-all');
  if records->>'available'<>'false' then raise exception 'crowd signal leaked before 30 prior completions'; end if;
  for i in 1..30 loop
    uid:=gen_random_uuid();
    insert into auth.users(id,email) values(uid,'historical-'||i||'@example.test');
    insert into public.game_attempts(user_id,mode,game_day,question_ids,
      answers,next_index,score,completed_at)
    values(uid,'daily',(clock_timestamp() at time zone 'UTC')::date-1,
      array['atlas-geo-all','fit-v05-morning-drink','atlas-science-elements',
        'fit-v05-dessert','atlas-geo-africa','fit-v05-pets','atlas-wild-languages'],
      jsonb_build_array(jsonb_build_object(
        'questionId','atlas-geo-all','type','rare','category','WORLD',
        'response','Zimbabwe','accepted','Zimbabwe','points',850,'valid',true
      )),7,850,clock_timestamp());
  end loop;
  records:=public.outlier_past_answer_rarity('atlas-geo-all');
  if records->>'available'<>'true' then raise exception 'mature crowd data should be available'; end if;
  if (records->>'sampleSize')::integer<>30 then raise exception 'historical denominator incorrect'; end if;
  if (records->'answers'->0->>'name')<>'Zimbabwe' then raise exception 'historical answer frequency incorrect'; end if;
  if (records->'answers'->0->>'percent')::numeric<>100 then raise exception 'historical percentages incorrect'; end if;
  raise notice 'OUTLIER competition smoke passed — private friend leagues, weekly boards, history, review, real past responses';
end $community_test$;
