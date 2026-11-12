-- DISPOSABLE TEST FIXTURE ONLY. Never deploy to a real ranked environment.
-- These rows deliberately copy PUBLIC prototype answers to test the secure RPCs.
-- Real ranked content must use distinct privately authored keys not in GitHub.
insert into private.ranked_question_bank(id,kind,pool_group,category,prompt,detail,answers,choices)
select 'rk_fixture_'||id,kind,
  case when kind='fit' then 'fit'
    when id like 'atlas-geo-%' then 'geo'
    when id like 'atlas-science-%' then 'science'
    when id like 'atlas-wild-%' then 'wild'
    when id like 'pack-%' then split_part(id,'-',2)
    else 'wild' end,
  category,prompt,detail,answers,choices
from private.question_bank
where kind='fit' or id like 'atlas-%' or id like 'pack-%'
on conflict (id) do nothing;
