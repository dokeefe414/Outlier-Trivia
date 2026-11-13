# OUTLIER v1.6 — Universal Answer Atlas

OUTLIER's accepted-answer coverage now spans **all twelve Stand Out topic groups**. The objective is reliable breadth: a very large set of specific, source-backed correct answers, searchable aliases and typo tolerance, **not** a generative judge that can invent facts or change point values after games finish.

## Audited release totals

The `npm run audit:content` report for v1.6 includes:

| Measure | v1.5 | v1.6 |
| --- | ---: | ---: |
| Stand Out question types | 155 | **235** |
| Fit In question types | 53 | **53** |
| Accepted answer slots (across rare prompts) | 37,805 | **107,588** |
| Approved alternate-name slots | 36,249 | **104,286** |
| Unranked, broad new question types | — | **80** |

An **answer slot** is one accepted canonical answer on one prompt. The same real-world item can be represented on several prompts, so the count is *not* the number of distinct real-world items. Alternate-name slots likewise repeat within and across prompts. All rarity points remain fixed editorial estimates, not measured player selection frequencies.

## Source records imported

### Films, television, video games, anime and manga

[Filmmap Dataset](https://github.com/Flightmussy/filmmap-dataset), CC0 1.0, produced from Wikidata statements. We used its **August 18, 2026** productions snapshot. The imported source names and Wikidata QIDs are filtered by the number of Wikimedia sitelinks as a basic prominence criterion (not a quality or player-frequency measure):

| Production type | Distinct source rows | Minimum sitelinks |
| --- | ---: | ---: |
| Films | 7,716 | 20 |
| Television series | 1,818 | 12 |
| Video games | 1,311 | 15 |
| Anime | 388 | 10 |
| Manga | 307 | 10 |
| **Total** | **11,540** | |

The **17 new media prompts** divide films by release era and title initial, television by premiere period, games by year, and anime/manga by archived title. Canonical labels include the historical year. A simple title is accepted as an alias only when it identifies one eligible title **within that exact prompt**. Thus a remake is not silently confused with the original. If a production exists outside this sourced snapshot, it may be factually valid elsewhere but is not an accepted answer to a question that names this source.

### MLB history: professional player name coverage

[Chadwick Baseball Bureau Persons Register](https://github.com/chadwickbureau/register), **Open Data Commons Attribution 1.0 (ODC-BY)**, imported on November 13, 2026 using the public register's 16 `data/people-[0-f].csv` source files.

We included **23,485 source records** with a first MLB-listed playing year between 1871 and 2026. Six new prompts divide these identities into historical first-listed-year windows. The canonical answer includes a year disambiguator; the player's full name is also accepted if it uniquely identifies an eligible person for that particular window.

**Important historical detail:** Chadwick's `mlb_played_first` is **the source's first MLB-listed playing season**, not necessarily the popular biography's stated American/National League debut. Some recognized Negro League histories can carry different years. Prompts and canonical labels explicitly say *first listed* rather than pretending there is one uncontroversial professional debut definition. We preserve Chadwick's identifiers in the archive to resolve duplicate names.

The register is subject to **ODC-BY attribution**. This document and the source modules prominently credit Chadwick; reuse and redistribution of derived player records must preserve the license notice and attribution. No proprietary MLB roster or premium statistics service is required at runtime.

### All other topics

We imported **14,543 additional source-list rows** from 31 [Darius Kazemi Corpora](https://github.com/dariusk/corpora) public-domain/CC0 historical sample lists (some rows may repeat across different inventories). The compilation is archived as of November 13, 2026.

Examples of the new accepted-name catalogs:

- **Music:** Rock and Roll Hall of Fame performers, 2007–2025 XXL Freshmen, MTV's first-day artists and songs, classical guitarists
- **Sports:** historical Minor League Baseball team names and diverse sports/activity names, alongside the large Chadwick MLB player prompts
- **People:** 700 names from an archived British-actors sample and a historical 100-person wealth list
- **History:** bestselling books, literary surnames, and Egyptian deities
- **Science:** programming languages, minor-planet names, meteorology terminology and academic subjects
- **Geography:** English towns and cities, rivers, and city/state airport reference names
- **Food:** 1,000 apple cultivar names, 528 tea terms, sandwiches, herbs/spices and historical menu items
- **Animals:** horse breeds and varieties, cat breeds
- **Games:** tabletop RPG titles and RPG designers, in addition to the much larger media video-game catalog
- **Wildcard:** named colors, occupations and plant names

We generated **57 new** CC0 catalog question types, covering entire bounded lists and sensible A–M / N–Z splits. Together with the 17 media and 6 baseball types, this makes the **80 new broad questions**.

The original **37,805** v1.5 accepted slots, original approved aliases and all daily scoring remain intact. Each newly added prompt identifies the particular historical collection it uses, including restrictions in its wording.

## How answer matching works

1. Determine which **specific source-scoped question** was asked.
2. Load its canonical approved name list and reviewed alternative forms, not the union of every noun or movie on the planet.
3. Normalize accents, whitespace and safe punctuation. Preserve programming-language **plus and sharp** symbols, so `C`, `C++` and `C#` do not collapse to one string.
4. Match an exact canonical label or its explicitly approved alias. For first-character-through-last-character typos, use indexed deletion fingerprints. A candidate must be **one edit away from exactly one canonical answer identity**; if two approved entries are equally plausible, reject rather than choose at random.
5. Award **only the answer's published editorial point value**. An LLM's opinion, spelling similarity alone, a previous player's guess, or a lookup result does not create a new valid answer.
6. Use the searchable answer explorer to discover approved alternatives. It examines the entire answer index while rendering at most 80 suggestions at once for mobile performance.

For baseball, `Babe Ruth` matches a historically sourced player in the correct archive window, not a random name. For films, `The Godfather` can resolve to the eligible dated film while year-specific remakes remain separate. Truly ambiguous names may require year or other source-specific disambiguation.

## Where the expanded material is playable

**Immediately in the free browser guest game:**

- **THE BIG LIST:** seven unranked Stand Out questions, sampled from seven **different subject groups** per run.
- **Knowledge Arcade:** all normal practice formats and all twelve category choices now use the expanded library.
- **Pass & Play:** custom 2–8-player, 1–7-game local matches draw from those same source-backed category inventories, preserving identical questions for each participant in a game.
- **Weekly Spotlight:** continues to use the existing unranked, deterministic weekly topic slate.

**Not changed:** existing official UTC daily schedules, local daily-streak records, historical daily scores, private hosted ranked bank, server multiplayer verification, consent settings or paid tiers. The new question objects are marked `arcadeOnly:true` and do **not** silently enter the official ranked data store.

**Fit In** remains intentionally a fixed crowd-prediction round with bounded survey-choice options (53 prompts): allowing unlimited free-response inputs would break the meaning of the existing proportion-based Fit In scores. This v1.6 change focuses on **Stand Out** rare-answer breadth.

## Maintenance and integrity

- Inspect the original source and dated scope before answering a missing-answer issue. An entity's existence is not proof that it appears in a historical sample.
- Run `npm run review:catalog -- candidate-answers.json` for source URI, license, snapshot-date, duplicate, and alias checks before a manual import.
- Run `npm run check`, `npm run audit:content`, then desktop/mobile browser checks. The CI suite also verifies hosted API types and PostgreSQL security.
- The v1.6 unit tests cover all twelve groups, 80 new prompts, film title aliases, MLB historical windows, programming `C++`/`C#` disambiguation, Big List diversity, unchanged daily scheduling, question reference integrity, and practice/party inclusion.
- Source data can contain mistakes, dated names, uncommon variants or omissions. Record corrections with evidence, review them by question, and version changes affecting competitive play.

## Limits and future growth

These source lists are **large but finite**. A correct fact outside the named archive is not automatically accepted. For open-world coverage beyond sources, the next engineering layer would be a reviewed knowledge-graph identity resolver (e.g. Wikidata QIDs with dated validity rules), a human-review queue for missing answers and server-side immutable answer-bank versioning. Do not install an uncontrolled generative AI grader that awards points without provenance.

The website's distributed practice questions are public. Only the separately provisioned optional hosted official ranked bank is private. There are no new payments, external API secrets or unverified leaderboard scores in this update.
