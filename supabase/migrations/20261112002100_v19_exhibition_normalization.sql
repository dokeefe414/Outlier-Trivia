-- v1.9: match guest JS normalization of programming-language identifiers.
-- A source-bounded exhibition library includes C, C++, C#, A# and more.
-- Distinct canonical entities must not collapse by silently discarding + or #.
-- This change is additive: no existing historic scores/answers are edited.
-- v0.9 hosted/guest answer normalization parity for approved entities.
-- Static SQL implementation; no optional extensions, external API or fuzzy AI.
create or replace function private.normalized_answer(p_text text)
returns text language sql immutable strict
set search_path=private,pg_temp as $$
  select regexp_replace(
    translate(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(p_text),'+',' plus '),'#',' sharp '),'ß','ss'),'æ','ae'),'œ','oe'),'þ','th'),'♀','female'),'♂','male'),'№','number'),'&',' and '),'àáâãäåāăąçćčďđðèéêëēĕėęěğģìíîïīĩįıĸłľñńňòóôõöøōőřŕśšşťùúûüūůűýÿžźż','aaaaaaaaacccdddeeeeeeeeeggiiiiiiiikllnnnoooooooorrssstuuuuuuuyyzzz'),
    '[^a-z0-9]','','g')
$$;
revoke all on function private.normalized_answer(text)
  from public,anon,authenticated;
grant execute on function private.normalized_answer(text) to service_role;

-- Source-verified distinguishing forms; fail migration if they collapse.
do $normalize_exhibition$
begin
  if private.normalized_answer('C')=private.normalized_answer('C#')
    or private.normalized_answer('C')=private.normalized_answer('C++')
    or private.normalized_answer('C#')=private.normalized_answer('C++')
    or private.normalized_answer('A#')=private.normalized_answer('A+') then
    raise exception 'Distinct programming-language forms collapsed';
  end if;
end $normalize_exhibition$;
