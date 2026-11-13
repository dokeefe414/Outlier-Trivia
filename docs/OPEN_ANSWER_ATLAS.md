# OUTLIER v1.5 — Deep Answer Atlas

## What Krillion taught us (without copying its private data)

The original [Krillion FAQ](https://krillion.io/faq) says its owner constructs huge accepted-answer lists by merging dictionaries, Wikipedia, encyclopedias, and other reference data, then cleaning and reviewing the sets. Rarity is sometimes estimated using linguistic/name familiarity, and sometimes assisted by a language model with human review. **This does not mean its live judge accepts anything an AI says sounds plausible.**

OUTLIER implements the safe, reproducible part of that approach: **source-defined membership → normalized names/verified aliases → unambiguous typo checking → fixed editorial tier**. We do not use Krillion's proprietary published answer sheets, scrape competitors' databases, or send unreviewed guesses to an LLM.

## Source-backed expansion actually included

| Source snapshot | Distinct source records | Boundary |
|---|---:|---|
| [CC0 Corpora / US cities](https://github.com/dariusk/corpora/blob/master/data/geography/us_cities.json) | 1,000 | Archived U.S. top-1,000 city-population estimates, 2016 ACS 5-year snapshot; not all U.S. cities |
| [U.S. Census-derived FIPS county crosswalk](https://github.com/kjhealy/fips-codes/blob/master/state_and_county_fips_master.csv) | 3,195 | County and county-equivalent name/FIPS records; historical boundaries may differ from today's |
| [CC0 Corpora / dinosaurs](https://github.com/dariusk/corpora/blob/master/data/animals/dinosaurs.json) | 1,449 | Archived names including dinosaur groups; not an exhaustive modern taxonomy |
| **Total** | **5,644** | Unique *source records*, not necessarily 5,644 biologically distinct taxa or 5,644 living cities |

These records generate **18 new finite, broad Stand Out prompts** (all cities, alphabetical ranges, long city names, city-by-state; all counties, alphabetical ranges, county-by-state; dinosaur-name variants). A single source record may appear in several prompts, so *answer slots* are much higher than distinct source records.

The original 137 rare prompts and 53 Fit In prompts remain intact. The 18 new sets are identified with `arcadeOnly:true`: they are available in unranked guest practice, the customizable Pass & Play game, and the dedicated **THE BIG LIST** challenge. They are **deliberately excluded from already scheduled official daily and private online ranked games**. This avoids changing a seeded daily challenge midweek or leaking unapproved names into the frozen private question bank.

## How names work

- `Los Angeles`, `Los Angeles, California`, and `Los Angeles CA` resolve to the same known city when unambiguous in the 2016 catalog.
- County answers support `Lackawanna County, Pennsylvania`, `Lackawanna, Pennsylvania`, and `Lackawanna County PA`, using the FIPS source and state abbreviations.
- Names repeated in different states require a state qualifier. We **do not guess which Springfield or Washington County a player meant**.
- Diacritics, punctuation, capitalization, and approved nicknames are normalized; one-character typos match only one distinct canonical answer. An ambiguous one-character correction is not accepted.
- Invalid or unrecognized answers can be retried before the existing timer expires. Unknown claims are **not** automatically upgraded to correct answers; those require reliable evidence and editorial review.
- An indexed deletion-fingerprint matcher avoids scanning thousands of aliases for every typo. Exact matching is hash-based, and the one-edit check is applied before a possible match counts.
- The after-round answer explorer initially renders at most **80** entries. Search still examines the *full approved list*, preventing 3,000+ answer elements from slowing mobile rendering.

## THE BIG LIST — accessible directly from the home screen

This is a **seven-question, all–Stand Out, free, unranked practice mode** made entirely from the new broad datasets. Every prompt can accept dozens to thousands of valid names, depending on the source. Each question has 45 seconds; the maximum is 7,000 points. Each run selects seven distinct prompts. Its scores remain isolated from daily statistics.

The same new geography and dinosaur questions also appear in ordinary practice and the matching Pass & Play topic groups.

## Rarity scores and fairness

We **do not claim** that an editorial score of 900 means 90% rarity, or that it measures the percentage of players who chose an answer. For city questions, broad points bands use the archived population rank only as an editorial familiarity proxy; counties and dinosaur names use explained approximate familiarity categories. The score is static and repeatable across players for each accepted answer, with explicit common-name exceptions. Real crowd percentages remain opt-in and available only through the separate hosted research features.

## Repeatable, evidence-first import workflow

Future growth should follow this process:

1. Choose a bounded prompt with precise eligibility wording: a dated roster, a versioned taxonomy, a specific census data snapshot, or a stated edition of a reference list. Open-ended membership must have clear rules.
2. Acquire a dataset with the necessary legal permission, provenance URL and snapshot date. Store the source metadata. Prefer public domain/CC0 or clearly licensed data, including Wikidata snapshots where the source membership can actually be verified.
3. Normalize canonical names and aliases; keep the identity/FIPS/QID when possible. Group aliases by identity. **Never map an ambiguous alias to a random item.**
4. Prepare a JSON candidate file containing `questionId`, `sourceUrl`, `license`, `snapshotDate`, and `answers` as `[name,editorialPoints,[aliases]]` rows. Run `npm run review:catalog -- path/to/candidates.json`. This preflight reports duplicate/ambiguous aliases, malformed points and provenance gaps. It **does not automatically publish** the candidate data.
5. Manually review source eligibility and editorial scoring, regenerate the approved snapshot and run `npm run audit:content`, `npm run check`, and browser CI. For hosted ranked play, independently curate and version a private bank; do not add or modify already-sealed official answer keys.
6. Record corrected omissions or misleading source restrictions in answer-review tickets. Improve aliases through tests. Avoid unbounded AI-only answer acceptance, which can hallucinate membership, leak answer keys or produce inconsistent scores.

Example candidate file:

```json
{
  "questionId": "example-snapshot",
  "sourceUrl": "https://example.org/public-data",
  "license": "CC0",
  "snapshotDate": "2026-11-13",
  "answers": [
    ["Example canonical name", 700, ["Verified alternate spelling"]]
  ]
}
```

## Honest limitations

- Large lists still omit valid answers that are outside **the named historical source**; a prompt must say which source it uses.
- City/population and FIPS datasets change; this version does not promise that the dated snapshot equals the current Census.
- The full source-backed answer lists are in the public guest bundle; only the optional Supabase ranked bank is private.
- This release adds no API-key-based live generative judge, accounts, payment changes, or unverifiable worldwide rarity statistics.
