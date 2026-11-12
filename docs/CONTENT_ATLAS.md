# OUTLIER Content Expansion v0.5

## Playability, not just a giant number

The game now has **137 Stand Out question types** (39 broad atlas prompts,
66 new entertainment/sports/nature topics, and 32 original legacy prompts)
and **53 Fit In prompts** (23 originals + 30 new).

The 66 new topical prompts collectively have **19,823 accepted answer
slots**. Combined with the 39 broad atlas prompts' 3,796, that makes
**23,619 broad-question answer slots**, often with hundreds of valid
responses for a single question. This is NOT 23,619 distinct real-world
people or things: the same answer can be valid in several variations.

### New areas

- Movies: ~255 reviewed film titles, with 7 constrained question variations.
- Television: ~998 TV series in the archived CC0 catalog, 6 variations.
- Music: ~415 performers, 369 genres, 55 instruments, 10 variations.
- Sports: 122 franchise/team names from historical NBA, NFL, NHL and MLB
  lists and 33 unique NBA MVPs through 2017, 9 variations.
- Animals: 134 common animals, 992 bird names on an archived North
  American checklist, and 453 dog breeds, 12 variations.
- Food: 80 fruits, 120 vegetables, and combined produce, 6 variations.
- Games: 650 distinct Pokémon names from an archival Pokédex and 212
  board game names, 7 variations.
- History: 328 scientists/inventors and 31 names from Greek mythology,
  5 variations.
- People: 990 entertainers and public personalities in a curated historical
  celebrity list, 4 variations.

The original countries/territories, languages, national parks, U.S. states,
capitals, and chemical elements remain fully supported. User-facing prompts
specify the finite approved reference (where useful), not a misleading
claim that any real-world answer will be automatically accepted.

**Important historical limit:** League datasets cover franchise names from
2016–2020. Their questions explicitly say that they use historical roster
snapshots; newly founded/rebranded teams are not automatically valid.
Likewise, an archived TV catalog is a subset of all television ever made,
not an exhaustive TV database. If a reasonable answer is omitted, use the
Answer Review link after the round.

### New daily rotation

Each day always has 4 Stand Out + 3 Fit In rounds. The Stand Out topics
are balanced among geography, movies, television, music, sports, wildlife,
science, food, games, history, and people. Every prompt appears at most once
per UTC Monday–Sunday week. All seven questions are locked per UTC date.

**v0.5 daily rotation begins on November 13, 2026 (UTC)**, so players who
already competed on November 12 do not suddenly receive a different slate
halfway through that day. Local saved question IDs remain authoritative
for in-progress guest games.

### Practice arcade

In the current unmonetized beta, players can select from **13 practice
topics** (including Surprise Mix). Four rare-answer rounds use that topic
and the other three rounds use varied Fit In prompts. These rounds are
unranked and never modify the three official daily/lifetime boards.

The $4.99 one-time lifetime premium unlock remains the planned
monetization. The online Stripe/Supabase layer is **optional and not
configured automatically by these commits**. Until you connect your own
accounts, guest practice is free for testing. Hosted practice currently
uses the random full content pool; a hosted category-picker entitlement
integration is not live yet.

## Data provenance and rights

All new topical factual names were adapted from the
[Corpora repository](https://github.com/dariusk/corpora) by Darius Kazemi,
a CC0 reference collection for creative projects. Corpora draws from
many historical snapshots and does **not** guarantee comprehensive
realtime accuracy. We retain compact snapshot fact files rather than
re-fetching arbitrary live text during every daily game.

Data files:
- src/media-facts.js
- src/nature-facts.js
- src/sports-facts.js
- src/hiphop-facts.js
- src/content-packs.js (rules, names, editorial rarity points)
- src/fit-expansion.js (new example Fit In boards)

All datasets contain names/titles and basic classification facts, **not
copyrighted movie scripts, song lyrics, images, or music playback.**

## Scoring honesty

**Editorial scores are NOT true crowd rarity.** We assign fixed prototype
tiers based on a short common-answer list, title structure, and basic
notability approximations. Some placements will be imperfect. All accepted
answers still earn points, and no time bonus changes that.

Fit In percentages are also **fictional illustrative distributions**, not
responses collected from real users. Both should be replaced only after
collecting enough player samples, auditing alternative spellings, and
freezing daily score tables before each day's official game starts.

## Hosted account migration

The optional Supabase backend migrations are applied in order:

1. 20261112000100_initial.sql
2. 20261112000200_question_bank.sql
3. 20261112000300_answer_atlas.sql
4. 20261112000400 through 20261112000408 topical packs
5. 20261112000490_fit_expansion.sql
6. 20261112000500_daily_content_schedule.sql

Server snapshots match the same accepted names and prototype points as
the browser. Four verified server-checked rare answers and three
Fit In responses remain the scoring contract; paid hosted practice is
separate from ranked dailies. The backend uses a deterministic seeded
daily schedule and never changes the question IDs of an in-progress
server-recorded daily attempt.

## Quality checks

- Unit tests validate topic sizes, known answers, false answers, alias
  collisions, exact points and weekly selection determinism.
- Hosted parity tests ensure **every** score and approved answer is seeded
  into the server private question bank.
- PostgreSQL smoke tests validate DB migrations, paid-practice controls,
  server-side scores and the daily read/write flow.
- Browser E2E checks the full seven-question guest run, new Answer
  Explorer, category-selection screen, and mobile overflow.

## Next stage

A true "any movie, any athlete, any animal" game will eventually need
reference APIs or continuously maintained knowledge graphs, alternate
entity disambiguation, reviewed user suggestions, and audited global
crowd-frequency scoring. Today's larger data is a meaningful step,
not an unbounded knowledge engine.

## v0.9 editorial answer updates

The updated finite archive now distinguishes Nidoran♀ / Nidoran♂,
corrects Bob Pettit's spelling, and adds checked category-scoped
aliases for historic MVPs, film titles, dog breeds and other entities.
Popular MVP names use a reviewed editorial score adjustment; the
values remain estimated tiers rather than measured frequency.
Use `npm run audit:content` to audit accepted names, score ranges and
collisions. Existing sealed private ranked keys remain immutable.
