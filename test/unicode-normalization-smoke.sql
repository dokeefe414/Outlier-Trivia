-- Guest/server Unicode parity test for the private SQL normalizer.
do $unicode$
begin
 if private.normalized_answer('Côte d’Ivoire')<>'cotedivoire' then
   raise exception 'accents and apostrophes normalized incorrectly'; end if;
 if private.normalized_answer('Straße')<>'strasse' then
   raise exception 'German sharp-S normalized incorrectly';end if;
 if private.normalized_answer('L''œuvre')<>'loeuvre' then
   raise exception 'French ligature normalized incorrectly';end if;
 if private.normalized_answer('Łódź')<>'lodz' then
   raise exception 'Polish alphabet normalized incorrectly';end if;
 if private.normalized_answer('Nidoran♀')<>'nidoranfemale'
   or private.normalized_answer('Nidoran♂')<>'nidoranmale' then
   raise exception 'Pokémon genders must remain distinct';end if;
 if private.normalized_answer('AC/DC')<>'acdc' then
   raise exception 'title punctuation normalization broke';end if;
 if private.normalized_answer('Earth, Wind & Fire')<>'earthwindandfire' then
   raise exception 'ampersand normalization broke';end if;
 if has_function_privilege('authenticated','private.normalized_answer(text)','EXECUTE') then
   raise exception 'private normalization helper exposed to players';end if;
 raise notice 'Hosted answer normalization matches guest Unicode folding edge cases';
end $unicode$;
