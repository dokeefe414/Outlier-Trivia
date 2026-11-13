# OUTLIER v1.3 — Competition & Discovery

## Five coordinated upgrades

### 1. Verified multiplayer

The existing Supabase-backed ranked daily, four leaderboards, private leagues, and member-only 14-day rivalry service are preserved. v1.3 adds an always-visible league **Weekly Cup** exhibition match view pairing members and displaying only authenticated, server-derived weekly totals. The source of every point is a completed official daily; no practice runs or client-submitted scores are eligible. Pairings are provisional if a league adds a member; this is **not** a locked knockout bracket. League standings show provisional current-week leaders and finalized prior-week champions.

Real multiplayer remains **inactive** on the default public site until the owner privately deploys Supabase, imports a distinct audited ranked bank and tests at least two actual accounts.

### 2. Daily Debrief

A new result summary works in both local daily/practice and hosted results. It shows the strongest genuinely accepted rare answer, strongest crowd prediction, category performance, and missed opportunities. It derives all statistics from the actual session; it never describes editorial rarity points as surveys or invents users' choices. The public Answer Explorer and approved reference data remain the place to explore eligible answers. Longer-term sourced trivia notes require editorial verification before publication.

### 3. Consent-based crowd pulse

New migration: `20261112001700_v13_crowd_consent.sql`. Accounts have explicit, initially disabled crowd research consent. Toggling it through the authenticated API updates a timestamp. A `crowd-pulse` endpoint returns anonymous Fit In response counts only for a completed **official** question that the requester has already answered, using prior-day results completed **after** each participant opted in. Counts stay entirely suppressed until at least 30 eligible answers are present. Percentages describe this opted-in sample only; they never adjust a sealed score, leak answers to future questions, or claim population representation. Withdrawal immediately excludes past answers unless the user opts in again, when only later games count.

### 4. Weekly tournament and special challenge

The guest Knowledge Arcade gains a deterministic **Weekly Spotlight**: ten rare-answer questions and a featured topic, unchanged for all participants across one UTC week. It is free, unranked, and separate from the official daily. Personal bests are stored locally by week. The friend-league Weekly Cup uses server-verified weekly totals for provisional matchups, with the previous week's view locked to that period. In addition, **Pass & Play Duel** lets two friends use one device to take the same seven questions with hidden answers and scores until both finish. Local duels are strictly unranked. No fake global or real-time competitors are rendered.

### 5. Better answer QA

A new owner-side answer-proposal audit CLI checks the exact prompt and normalized collision risks before editorial changes. It does not automatically accept public suggestions. A proposal needs eligibility evidence tied to the particular dated source list and manual approval; new production ranked questions are versioned, never retroactively rescored. The Zendaya report (#1) is unresolved until the applicable archived reference can be verified.

## Activation order

1. Keep the free static game publicly playable and run `npm run check`, `npm run audit:content`, and browser CI.
2. Provision Supabase privately; deploy migrations through 017 in chronological order, configure Edge Function, protect all privileged routes, and test consent withdrawal plus 30-response suppression.
3. Curate and validate the PRIVATE ranked bank locally (never commit it); verify seven-day schedule and answer aliases.
4. Invite 20–50 consented testers. Check two real accounts/phones, league/Weekly Cup consistency, daily retry timers, review workflow, and crowd privacy.
5. Keep Stripe in test mode; only consider live payments after legal/privacy/support/refund requirements and customer tests.

### Known boundaries

- No production backend, actual new customer accounts, live matches, or collected crowd responses are created by GitHub commits.
- Weekly Cup is an exhibition pairing based on weekly standings, not a bracket with a persisted seeding or elimination system.
- The public guest game is client-owned and unverified. Only server-generated ranked game scores count as official.
- Real crowd samples will often be unavailable with fewer than 30 consenting prior-day respondents for the same prompt.
