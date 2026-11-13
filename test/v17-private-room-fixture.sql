-- Disposable CI ONLY: convenience fixtures for private-room security smoke.
-- Never run in a real project. Room bank MUST be separately curated.
insert into private.outlier_party_question_bank
  (id,kind,category,prompt,detail,answers,choices)
select 'party_fixture_'||id,kind,category,prompt,detail,answers,choices
from private.ranked_question_bank
where private.outlier_ranked_row_valid(kind,answers,choices)
on conflict (id) do nothing;
