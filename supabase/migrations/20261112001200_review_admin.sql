-- OUTLIER v0.9 — service-only review inbox, decisions, and audit trail.
-- Approval means editorial review completed; it NEVER modifies sealed
-- ranked questions, past scores, live rarity tiers or future question lists.
alter table public.answer_reviews
  add column if not exists review_note text,
  add column if not exists reviewed_by text;
create table if not exists private.answer_review_audit (
  id bigint generated always as identity primary key,
  review_id uuid not null references public.answer_reviews(id) on delete cascade,
  old_status text not null,
  new_status text not null,
  reviewer_note text not null,
  changed_at timestamptz not null default clock_timestamp()
);
revoke all on private.answer_review_audit from public,anon,authenticated;

create or replace function public.outlier_admin_review_queue(
  p_status text default 'pending',p_limit integer default 50
) returns jsonb language plpgsql stable security definer
set search_path=public,private,pg_temp as $$
declare v_result jsonb;
begin
  if p_status not in ('pending','needs_more_info','approved','rejected','all')
    or p_limit not between 1 and 100 then
    raise exception 'invalid_review_filter';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'questionId',q.question_id,
    'prompt',coalesce(bank.prompt,'Archived question'),
    'submitted',q.submitted_answer,'reason',q.reason,
    'status',q.status,'createdAt',q.created_at,
    'reviewedAt',q.reviewed_at,'note',q.review_note
  ) order by q.created_at asc),'[]'::jsonb) into v_result
  from (
    select * from public.answer_reviews
    where (p_status='all' or status=p_status)
    order by created_at asc limit p_limit
  ) q
  left join private.ranked_question_bank bank on bank.id=q.question_id;
  return v_result;
end $$;

create or replace function public.outlier_admin_review_decide(
  p_review uuid,p_status text,p_note text
) returns jsonb language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare
  v_old public.answer_reviews%rowtype;
  v_note text:=trim(left(coalesce(p_note,''),750));
begin
  if p_status not in ('approved','rejected','needs_more_info')
     or char_length(v_note)<12 then
    raise exception 'invalid_review_decision';
  end if;
  select * into v_old from public.answer_reviews where id=p_review for update;
  if not found then raise exception 'review_not_found'; end if;
  if v_old.status not in ('pending','needs_more_info') then
    raise exception 'review_already_processed';
  end if;
  update public.answer_reviews
    set status=p_status,review_note=v_note,reviewed_by='owner',
        reviewed_at=clock_timestamp()
    where id=p_review;
  insert into private.answer_review_audit
    (review_id,old_status,new_status,reviewer_note)
    values(p_review,v_old.status,p_status,v_note);
  return jsonb_build_object('id',p_review,'status',p_status,
    'appliedToQuestionBank',false,'retroactiveScoreChange',false);
end $$;

create or replace function public.outlier_review_my_tickets(
  p_user uuid,p_limit integer default 20
) returns jsonb language sql stable security definer
set search_path=public,private,pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'questionId',question_id,'answer',submitted_answer,
    'status',status,'createdAt',created_at,
    'reviewedAt',reviewed_at,'note',review_note
  ) order by created_at desc),'[]'::jsonb)
  from (select * from public.answer_reviews
    where user_id=p_user order by created_at desc
    limit least(greatest(p_limit,1),50)) rows
$$;

create or replace function public.outlier_admin_review_counts()
returns jsonb language sql stable security definer
set search_path=public,private,pg_temp as $$
  select jsonb_build_object(
    'pending',(select count(*) from public.answer_reviews where status='pending'),
    'needsMoreInfo',(select count(*) from public.answer_reviews where status='needs_more_info'),
    'approved',(select count(*) from public.answer_reviews where status='approved'),
    'rejected',(select count(*) from public.answer_reviews where status='rejected'),
    'total',(select count(*) from public.answer_reviews)
  )
$$;

revoke all on function public.outlier_admin_review_queue(text,integer) from public,anon,authenticated;
revoke all on function public.outlier_admin_review_decide(uuid,text,text) from public,anon,authenticated;
revoke all on function public.outlier_review_my_tickets(uuid,integer) from public,anon,authenticated;
revoke all on function public.outlier_admin_review_counts() from public,anon,authenticated;
grant execute on function public.outlier_admin_review_queue(text,integer) to service_role;
grant execute on function public.outlier_admin_review_decide(uuid,text,text) to service_role;
grant execute on function public.outlier_review_my_tickets(uuid,integer) to service_role;
grant execute on function public.outlier_admin_review_counts() to service_role;
