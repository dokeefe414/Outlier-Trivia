# Answer Atlas — broad rare-answer trivia (v0.4)

OUTLIER Stand Out questions now accept **many correct answers** instead of
requiring one of a few famous examples.

## Sources and scope

| Dataset | Canonical entries |
| --- | ---: |
| ISO 3166-1 countries and territories | 249 |
| ISO 639-1 languages | 184 |
| IUPAC chemical elements | 118 |
| United States states | 50 |
| U.S. state capitals | 50 |
| United States national parks | 63 |

These sources produce **39 broad Stand Out questions**, each accepting **36–249
canonical names**. There are **3,796 answer slots across the questions**:
an answer may appear in multiple questions, so this does not mean 3,796
distinct real-world objects.

Four broad Stand Out rounds (two geography, one science, one rotating general
knowledge) now appear in each daily game, alternating with three Fit In
rounds. Weekly question rotation avoids repeating prompts within a UTC
Monday–Sunday week. Old questions remain for saved existing attempts.

## Answer validation

Country aliases, alternate element spellings, punctuation, accents, and
capitalization are supported. In guest mode, a one-character typo in a
long answer is accepted only when it identifies exactly one valid name.

For example: Ivory Coast / Côte d'Ivoire, United States / USA, Turkey /
Türkiye, Aluminium / Aluminum, and Persian / Farsi.

Country and region prompts use the **ISO 3166-1 and UN statistical region
conventions**. These are not declarations of sovereignty or political
status. Certain entities that exist outside the ISO reference are not
accepted for ISO-specific prompts. Each prompt names the relevant source
or convention where needed.

After each Stand Out question, the **Answer Explorer** reveals the entire
approved list with searchable names and points. When an answer is
rejected, the player can start a prefilled GitHub answer-review issue.

## Rarity scoring is not measured popularity

Current scores are **editorial prototype familiarity tiers**, not actual
player-frequency data. Familiar choices earn fewer points, deep cuts earn
more, but the values do not tell you what percentage of players selected
each name. The Fit In crowd percentages are still illustrative.

Actual data-driven rarity will require a large enough real audience,
fixed daily score tables, privacy-friendly response counting, spelling
review and a transparent appeal process.

## Reference sources

- Country and UN region dataset:
  https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes
- Language code dataset: https://github.com/haliaeetus/iso-639
- Chemical elements: https://github.com/andrejewski/periodic-table
  and https://iupac.org/what-we-do/periodic-table-of-elements/
- US state capitals (USGS-based):
  https://vega.github.io/vega-datasets/datasets/us_state_capitals/
- US National Park Service: https://www.nps.gov/aboutus/national-park-system.htm

Only names and reference facts were used; not protected prose,
photography or article text.

## Code structure and maintenance

- src/atlas-data.js: compact reference snapshot and source facts.
- src/atlas-questions.js: frozen 39-question set with reviewed aliases
  and editorial scoring.
- src/data.js: combines the broad and legacy prompt banks.
- src/game.js: deterministic official daily selection.
- supabase/migrations/20261112000300_answer_atlas.sql: server-only
  question seed and online large-pool daily selection.
- test/atlas.test.js: pool counts, aliases and weekly uniqueness.
- test/hosted.test.js: validates server seed and client parity.
- e2e/browser-smoke.mjs: exercises the Answer Explorer in a browser.

The source snapshot is deliberately pinned. Do not alter the score of
an active official daily prompt without versioning it, because that
would make comparisons unfair. Server-side scoring remains an
optional, owner-configured feature, not active on default GitHub Pages.

## Still to improve

This is a broad structured trivia dataset, not arbitrary free-text
Wikipedia matching. "Name any athlete/movie/animal" needs separate
reviewed authoritative data and eligibility rules. The next content
expansion should target those fun domains without accepting invented
or incorrect names. Exact data-derived rarity also remains future work.
