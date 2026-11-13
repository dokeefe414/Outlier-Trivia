# OUTLIER v1.1 — Game Feel, Player Identity & Rivalries

## What is playable immediately

**Rare-answer moments:** Every accepted Stand Out answer now has a personalized
score moment. Picks at 850+ trigger a brighter diamond reveal, and 950+
trigger the highest-tier gold celebration. Reduced-motion settings disable
particle animation. Scores still come from verified **approved library
entries** and editorial point tiers, NOT population response frequencies.
When a player gets an accepted unusual answer, the reveal explains how
many *other approved entries* have lower editorial point scores. It does not
claim how many people knew or guessed that answer.

**Earned player identity:** The free guest profile now has five titles
(Curious Mind, Knowledge Seeker, Archive Diver, Rare Mind, OUTLIER Legend)
and five visual frames (Classic, Stargazer, Diamond, Perfect Seven,
Marathon). Items unlock only from completed **official** daily games and
specific earned milestones. A player may switch unlocked items in the
profile; choices persist locally in browser storage. Cosmetic XP is
derived from real completed official daily points, but XP never
affects standings, acceptance, question timers, or purchases.

**Weekly knowledge quests:** Four cosmetic missions track completed days,
approved Stand Out answers, top Fit In predictions, and official weekly
points. Missions reset on Monday UTC. They never grant purchased access
or influence leaderboards. No extra gameplay time is required.

**Knowledge Atlas:** The personal profile now shows the five most
memorable distinct approved rare answers, strongest category by average
points, an area to improve, unique accepted responses, separate Stand Out
and Fit In acceptance percentages, and the average of the most recent
seven completed daily games. Practice and unfinished days never influence
these official personal metrics.

**Library suggestion flow:** At the end of each Stand Out round, players
can submit a missing-answer idea through a structured GitHub issue that
asks for the particular question, eligibility explanation and a credible
reference. This is opt-in; no answer history or account data is
automatically uploaded. The existing post-round Answer Explorer stays
available. Curators review suggestions; there is no unrestricted
AI guessing, automatic inclusion of unverified entities or retroactive
revision of official scores.

## Online verified head-to-head (requires Supabase)

v1.1 extends optional private friend leagues with a **14-day Rivalry**
view. A league member can tap **DUEL** next to another member and compare
their completed official daily scores on the same UTC dates. The score
service returns:
- Your wins, the other player's wins, ties.
- Your current consecutive head-to-head win count.
- The date and both verified total daily points for **mutually
  completed** official games only.
- A spoiler-free share invitation link.

A game that only one person completed is **excluded**. Raw answers, future
question pools, payment records and review tickets are never included.
The RPC denies outsiders and requires both people to be members of the
same private friend league. It never accepts user-supplied scores.
Practice and locally spoofable Beat My Score challenges remain
**unranked**, separate from verified rivalries.

New migration: \`20261112001600_rivalries.sql\`.

This feature is **not live** until the owner connects Supabase and
configures a verified private ranked-question bank. The public static
site still offers free guest play; connecting an external service does
not automatically mean a public multiplayer launch.

## Design and mobile accessibility

The update adds bright but restrained rarity moments, CSS-only
starbursts for rare discoveries, focusable player identity controls,
mobile-responsive mission and profile cards, high-contrast league
duel styling, and reduced-motion animation fallbacks.

All major mechanics are still unchanged:
- Seven identical official daily questions, maximum 7,000 points.
- Four Stand Out and three Fit In rounds; one attempt per UTC day.
- Rejected Stand Out guesses can be retried within the original timer.
- Practice remains unranked; the $4.99 lifetime unlock is optional
  hosted infrastructure, not an active payment service.

## Safety, QA, and honesty

Automated tests exercise:
1. Local official-only achievements, distinct rare memory curation,
   title/frame unlocking, weekly quest resets and safe defaults.
2. Rare moment tiers and editorial-vs-player-popularity disclosure.
3. PostgreSQL membership checks, symmetric rivalry scoring, rejection
   of self/outsider requests and omission of nonmutual games.
4. Headless desktop/mobile gameplay, saved cosmetic selections,
   high-energy answer moment, and horizontal-overflow checks.
5. Existing content audits, backend TypeScript and PostgreSQL security.

No real live multiplayer testing or Stripe transactions have occurred.
A future owner-supervised 20–50 person beta is still needed to identify
incorrect rejections and evaluate whether players return each day.

This update deliberately prioritizes *enjoying the game*, with honest
separation between cosmetic local progression and server-verified
competition.
