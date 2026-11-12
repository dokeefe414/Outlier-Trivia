-- v0.9 hosted/guest answer normalization parity for approved entities.
-- Static SQL implementation; no optional extensions, external API or fuzzy AI.
create or replace function private.normalized_answer(p_text text)
returns text language sql immutable strict
set search_path=private,pg_temp as $$
  select regexp_replace(
    translate(replace(replace(replace(replace(replace(replace(replace(replace(lower(p_text),'ß','ss'),'æ','ae'),'œ','oe'),'þ','th'),'♀','female'),'♂','male'),'№','number'),'&',' and '),'àáâãäåāăąçćčďđðèéêëēĕėęěğģìíîïīĩįıĸłľñńňòóôõöøōőřŕśšşťùúûüūůűýÿžźż','aaaaaaaaacccdddeeeeeeeeeggiiiiiiiikllnnnoooooooorrssstuuuuuuuyyzzz'),
    '[^a-z0-9]','','g')
$$;
revoke all on function private.normalized_answer(text)
  from public,anon,authenticated;
grant execute on function private.normalized_answer(text) to service_role;
