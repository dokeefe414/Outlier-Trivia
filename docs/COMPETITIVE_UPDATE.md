# OUTLIER v0.6 — Arcade, Weekly Journey, and Community Beta

**Status:** The guest practice arcade and local progression screens run on GitHub
Pages without an account. Friend leagues, verified global weekly ranking,
server-side answer reviews, and historical player-response insights are
**source implementations only** until the owner connects and deploys Supabase.
No purchases or public accounts are activated simply by this code commit.

## Three practice formats

- **Classic:** 7 questions, 4 Stand Out + 3 Fit In, 45 seconds each,
  maximum 7,000 points.
- **Quick Hit:** 3 questions, 2 Stand Out + 1 Fit In, 35 seconds each,
  maximum 3,000 points.
- **Rare Rush:** 10 Stand Out questions, 30 seconds each, maximum
  10,000 points. A chosen category dominates the mix; other topics
  fill the remaining slots when fewer than 10 reviewed prompts exist.

Each format can be started from the practice subject picker. Practice
scores are **never official or ranked**. A local personal best is stored
for each category/format combination. Official daily gameplay is
unchanged: seven questions, 45 seconds each, 7,000 maximum.

## Reasons to return daily

- A Monday–Sunday UTC **weekly mission**, weekly points and next
  completed-day milestone.
- Countdown to the next official daily game at **00:00 UTC**.
- A **28-day journey** chart with daily-score history, weekly average
  on played days, streaks and personal goals.
- A result comparison against your previous official score and earlier
  average.
- Existing streaks, badges, Knowledge DNA, Answer Explorer and
  Beat My Score URLs are preserved.

These are **personal browser statistics** until hosted accounts are
activated; they are not public rankings or cross-device records.

## Hosted community features (requires external deployment)

New migration: supabase/migrations/20261112000600_friends_reviews.sql

1. **Friend leagues:** Create up to three leagues and join up to twelve.
   Each invite code is randomly generated and each league holds up to 50
   members. Only members can see standings: Today, Week, All-time.
2. **Global weekly rankings:** Sum verified official daily points for
   the current UTC week. Practice is never counted.
3. **Official score history:** A signed-in user's recent server-verified
   daily scores, independent of guest browser storage.
4. **Answer-review inbox:** Authenticated users may request a review
   only for an invalid response in their own game. Four submissions
   per rolling day, with pending updates idempotent. Human review is
   necessary; tickets do not automatically change published scores.
5. **Historical response-frequency research:** Prior-day completed
   official responses can be counted by question. Fine-grained counts
   stay hidden until at least **30 past responses** exist. These
   observations are not a measured rarity score and do not change
   the frozen editorial points.
6. **More forgiving server validation:** Unambiguous one-character
   typos in longer valid answers can earn the same points as the
   canonical spelling, as in local guest mode.

### New API routes

- GET action=leagues
- POST action=league-create (title)
- POST action=league-join (code)
- GET action=league-standings (league UUID, period)
- GET action=leaderboard&board=week (public weekly rank)
- POST action=review (game UUID, question ID, reason)
- GET action=profile now includes official score history.
- POST action=answer may include previous-day response frequencies
  when at least 30 historical answers to that question exist.

All database records and scoring functions are protected by service-only
RPC permissions; the Edge Function verifies the user's identity and
checks membership/ownership. Do not put service-role, Stripe, or webhook
secrets into GitHub or browser source.

### Activating it

Follow docs/ONLINE_SETUP.md, use an owner-controlled Supabase project,
apply the new migration, deploy the Edge Function, configure auth email
delivery, and test a real two-account game on desktop and mobile. Stripe
test mode must be verified before switching on the planned $4.99
one-time purchase. Live customer support, refund, privacy, moderation
and account deletion processes still need operational setup.

## Quality assurance

CI covers JavaScript syntax/unit tests (formats and journey), Edge
Function Deno type checks, Postgres security/scoring/league/review
integration tests and real headless Chromium desktop/mobile playthroughs
of Classic daily, Quick Hit and Rare Rush.

### Scoring integrity

A true popularity-derived score requires sample sizes, smoothing,
alias review and score tables locked BEFORE each daily competition.
Historical response counts are a useful early research signal, but
should never retroactively alter scores or be represented as global
population preferences. Official scores continue to use the clearly
labeled curated prototype rarity tiers until a robust replacement
is designed and deployed.

## Honest limits

Guest records live in the current browser. Friend leagues and public
rankings are not live without Supabase. The existing historical movie,
music and sports answer pools are finite—not unlimited Wikipedia-scale
matching. Account deletion, moderation/reporting, live payment support,
accessibility auditing and operations monitoring must be addressed
before a large public launch.

This release prioritizes joyful replay, credible competition,
recognizable progress and easy ways to involve friends.
