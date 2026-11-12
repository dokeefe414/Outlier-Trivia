# OUTLIER v0.9 — Answer Intelligence, Editorial Fairness & Beta Preparation

## What changed in the playable site

**Answer recognition:** The finite, validated answer libraries now use
Unicode-safe normalization (accents, ligatures, typographic punctuation, and
Pokémon gender symbols), explicitly reviewed alternate names, and a fast
one-edit typo check. A typo only counts if it identifies **one** canonical
answer within the question's specific answer library. It never falls back to
AI-generated guesses or arbitrary internet search.

Examples: "Steph Curry" → Stephen Curry; "Shaq" → Shaquille O'Neal;
"Star Wars" → Star Wars: Episode IV – A New Hope; "GSD" → German Shepherd;
and "Einstein" → Albert Einstein on the scientific figures question.
Ambiguous nicknames are not awarded to an arbitrary entity. Incorrect
answers can still be retried without resetting the original timer.

**Content quality:** A historical MVP entry has been corrected from
"Bob Petit" to **Bob Pettit** (see NBA / Basketball Hall of Fame).
Both Nidoran♀ and Nidoran♂ now count as distinct approved Pokémon.
The other content packs retain their finite historical scope. Because
we cannot automatically identify every legitimate film, artist or animal
from an arbitrary phrase, player reports still need editorial review.

**Scores:** The obvious-name NBA MVP examples have been editorially
rebalanced: Stephen Curry earns 180 points, Michael Jordan 120,
LeBron James 150, while less commonly recalled historic winners such as
Wes Unseld and Dave Cowens receive higher tiers. These are not
historically measured player-guess frequencies. Published ranked
questions are immutable and are never automatically rescored.

**Reveals:** Accepted nicknames and minor spelling repairs are called out
after submission. The score reveal shows how the answer compares to
the **other approved answer scores for that question**, NOT how many
real-world people would choose it. The total accepted-answer explorer
remains hidden until the round ends.

**Automatic audit:** Run \`npm run audit:content\` to scan every prompt for
collision-prone aliases, invalid score ranges, duplicate IDs and short
answer pools. The latest pack has **105 broad Stand Out prompts** and
**23,619 accepted answer slots across the broad question variations**;
an entity may appear in several variations.

## Editor's review workflow

v0.9 adds an owner-only dashboard at \`/admin.html\`. It requires a
connected Supabase backend and a strong **OUTLIER_ADMIN_TOKEN** (at least
32 characters) configured as an Edge Function secret. The token is
typed into the browser and stored **only in JavaScript memory**, not
cookies, localStorage, source files, or URLs.

The dashboard shows a pending answer-review queue, contextual question
prompts, written explanations, review notes and the status history.
The owner's three decisions are:
- **Approve** for a VERIFIED suggestion to add to a future versioned
  question, after checking an independent source.
- **Reject** if the proposed answer is invalid or outside the question.
- **Needs more info** to request a better public reference.

Every status change is audit-logged. Players can see their own ticket
statuses on the connected account page. **Approval never inserts
an answer automatically**, never alters sealed ranked questions and
never retroactively changes official points.

The GitHub guest review flow remains public GitHub Issues and therefore
needs a GitHub account to submit. Guest reports are not automatically
stored on Supabase, and no guessed answer is uploaded invisibly.

See [ANSWER_REVIEW_GUIDE.md](ANSWER_REVIEW_GUIDE.md).

## Readying the multiplayer beta

The previous private ranked bank remains empty by design. We have NOT
connected a Supabase/Stripe project, activated real leaderboards, created
private answer keys, invited beta users, or accepted payments. The
existing hosted league, standings, purchase and historical-response
code is still optional infrastructure.

The new local tool:
- \`node scripts/validate-private-bank.mjs --new-id\` produces a secure
  random stable ID for one privately curated question.
- Save privately authored question data at \`private/questions.json\`.
- \`node scripts/validate-private-bank.mjs private/questions.json --validate-only\`
  checks score ranges, answer completeness, alias ambiguity, legal
  daily group coverage, and Fit In percentages.
- Without \`--validate-only\`, it writes an additive Supabase SQL import
  to \`private/generated-ranked-import.sql\`, which is gitignored.
- Never commit either file to public GitHub. Never run the old public
  \`test/private-question-fixture.sql\` in production.

The tool validates a privately authored bank **without building one out
of public answers**, since doing so would reveal future competitive
answers in the GitHub repository.

The launch still needs an owner's Supabase project, Stripe merchant
setup (test mode first), human moderation, appropriate privacy/support
procedures, and a small opt-in beta with real users.
See [BETA_READINESS.md](BETA_READINESS.md).

## Automated verification

The new checks include:

1. Unicode spelling and alias matching, 100+ curated broad answer lists,
   collision protection, false-positive and ambiguous cases.
2. Explicit tests for chosen popular vs obscure editorial score tiers.
3. Historical server seed parity, including the v0.9 alias migrations.
4. PostgreSQL tests for the review inbox, queue permissions, state
   transitions, audit trail, and immutable official scores.
5. Headless desktop/mobile Chromium tests for retry counts, valid
   answer reveals, and a locked admin screen when Supabase is blank.

## Source transparency

The underlying reference facts come from the cited collections in
[CONTENT_ATLAS.md](CONTENT_ATLAS.md) and [ANSWER_ATLAS.md](ANSWER_ATLAS.md).
Additional explicit alias curation includes:
- [NBA — Bob Pettit](https://www.nba.com/news/bob-pettit-obit)
- [Basketball Hall of Fame — Bob Pettit](https://www.hoophall.com/hall-of-famers/bob-pettit)
- [NBA official player and team names](https://www.nba.com/players)
- Historically named films and other factual terms from the project
  content's CC0 Corpora reference.

Some names and eligibility criteria still need human review. This
release deliberately does not claim encyclopedic, unconstrained
AI answer validation or true population-based rarity.
