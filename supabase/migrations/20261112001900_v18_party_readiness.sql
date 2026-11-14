-- OUTLIER 1.8: private multiplayer readiness is independent of the
-- separately curated official ranked daily bank. Never expose questions.
create or replace function public.outlier_party_readiness()
returns jsonb language sql stable security definer
set search_path=public,private,pg_temp as $$
  select jsonb_build_object(
    'ready',(count(*) filter(where kind='rare')>=4 and
      count(*) filter(where kind='fit')>=3),
    'rareQuestions',count(*) filter(where kind='rare'),
    'fitQuestions',count(*) filter(where kind='fit')
  )
  from private.outlier_party_question_bank
$$;
revoke all on function public.outlier_party_readiness()
  from public,anon,authenticated;
grant execute on function public.outlier_party_readiness() to service_role;
