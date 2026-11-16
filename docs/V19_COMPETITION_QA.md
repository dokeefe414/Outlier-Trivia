# OUTLIER v1.9 — The Inner Circle: verified game nights and answer quality

**Status:** source implementation with CI-backed database/browser tests. The static guest game continues working without Supabase. Authenticated remote rooms require an owner-provisioned Supabase project, a private source-reviewed exhibition bank and genuine cross-device playtesting. **Nothing in this repository merge supplies hosted credentials or verifies human beta participants.** The public Pages site is not a live hosted multiplayer server by itself.

## Release scope

### 1. Private-room ready-up and player activity

The server now requires **every one of the 2–4 players** to actively mark READY before the host may start a synchronized match. A player can toggle readiness while waiting, but not after the room starts; guests may leave a waiting lobby, and the host can cancel it for everyone. Each server state fetch updates the caller's *last seen* timestamp. The roster marks members ACTIVE only if a verified server ping was received within 15 seconds. This is a **recent-activity hint**, not a claim of an uninterrupted websocket connection or guaranteed internet access.

- Database migration: `supabase/migrations/20261112002000_v19_room_competition.sql`.
- Protected RPCs: `outlier_party_ready`, `outlier_party_leave`; `outlier_party_start` now checks unanimous readiness under the room row lock.
- Authenticated, rate-limited Edge actions: `party-ready`, `party-leave`, plus the original `party-create`, `party-join`, `party-start`, `party-state`, `party-answer`.
- The server remains authoritative for the **5-second countdown and 7 × 45-second windows**. Reconnects never extend a round. Room activity changes only display status, not scores.

### 2. Unanimous rematches

After the 315-second shared round clock closes, each participant can vote for a rematch. Votes are stored in a restricted database table, so reloading doesn't erase them and repeat clicks do not create extra votes. **Only when every participant explicitly votes** does the server create a new room with the same 2–4 authenticated members. A rematch receives new question IDs and a fresh 30-minute waiting-lobby expiration, and **all players must ready up again**. The original match's answers and scores remain unchanged.

The source of truth is `outlier_party_vote_rematch`; the browser only displays vote progress and, when complete, an invitation to enter the new waiting room. Nobody is automatically forced into new gameplay.

### 3. Server-verified friend records and private seasons

A player's signed-in online hub can show an authenticated record of finished **private matches they actually joined**. The new endpoints return only scores and results, **never raw guesses, answer keys, service secrets or spectators' data**:

| API action | Database RPC | Output |
|---|---|---|
| `party-history` | `outlier_party_history` | Last up to 20 completed rooms: date, own score, real win/tie/loss, winner display names |
| `party-season?period=week\|month\|all` | `outlier_party_season` | Friend-only wins, ties, losses, games and points across up to the 150 most recent finished rooms the requester joined (for the long-range view) |
| `party-rivalry?opponent=<uuid>` | `outlier_party_rivalry` | Wins/losses/ties over only the rooms **both** users entered |

A tied highest score is a **tie**, not a win for all participants. Match records exist only after the shared server clock is over and are based on stored server-scored answers. A 2–4 player match can produce multiple losses per win, which is why this is a *match record*, not an Elo rating or a global ranked ladder. Season views are **friends-only and membership-scoped**, not public leaderboards. These exhibition results never count toward official daily play, category mastery, streaks or billing.

### 4. Independently sourced exhibition bank preparation

The production `private.outlier_party_question_bank` remains **empty in public schema migrations**. To make room deployment feasible without borrowing or leaking future official daily questions, the repository now includes a **reviewable, opt-in export**:

```bash
npm run audit:exhibition
npm run prepare:exhibition
```

The first command audits the separate source-scoped archive and editorial choices without writing. The second writes `private/generated-exhibition-import.sql` **only under gitignored `private/`**, with no overwrite. The owner must inspect it and then import it manually to an authorized Supabase project.

- **18 separate Stand Out prompts** from existing archived CC0 Corpora collections, all already marked `arcadeOnly`. These prompts have at least 28 canonical responses each and pass alias/point auditing. Their exact historical reference scope appears in the question, so players are not promised that every real-world example qualifies.
- **10 original Fit In prompts** with six choices apiece and openly **editorial example weights**, never mislabeled measured public opinion. All six weights sum to 100, are bounded, and normalized choices are unique.
- **28 exhibition prompts total**, enough for separate server-curated seven-question rooms. The answers are drawn from material already public in the guest library; therefore they are appropriate for an **unranked exhibition**, not an anti-cheat tournament.
- Source attribution: [Darius Kazemi's CC0 Corpora](https://github.com/dariusk/corpora), plus [v1.6 provenance](V16_UNIVERSAL_ANSWER_ATLAS.md). The current audited sample contains 9,748 approved rare answer slots across 18 prompts, not 9,748 unique independently verified world facts. This release does not add unlabeled automatic AI adjudication.
- The separate daily ranked private bank is unaffected. **Never promote exhibition prompts into future official daily slates**, and do not copy undisclosed official daily answers into this pack.

### 5. Answer-quality audit and source-based review

A new static **`quality.html` Public Answer Quality Monitor** audits the existing 107k+ answer-slot prototype: category coverage, 16 largest prompts, aliases, invalid points, normalized collisions, and malformed editorial Fit In distributions. It is designed for the owner, but everything it reads is **already public in the guest repository**. It is not a private dashboard and it does not access account data.

The owner-only hosted `admin.html` now links to it; hosted review tickets remain protected by the owner's secret and are never exposed in the public quality monitor. The `src/review-triage.js` offline workflow flags mechanically out-of-range A–M/N–Z answer proposals for special eligibility checks. It **does not auto-publish, auto-close, auto-approve, or rescore anything**.

#### Open answer reports reviewed for triage

These remain open pending primary/reference-list evidence:

- [#1 — Zendaya, celebrity N–Z](https://github.com/dokeefe414/Outlier-Trivia/issues/1): *verify against the exact finite dated celebrity source*; popularity alone is insufficient.
- [#3 — Avril Lavine, musician A–M](https://github.com/dokeefe414/Outlier-Trivia/issues/3): the reporter likely means Avril Lavigne; verify **whether that exact musician belongs to the Rock Hall/XXL source set**. A corrected spelling doesn't by itself establish source membership.
- [#4 — Utah Jazz, sports A–M](https://github.com/dokeefe414/Outlier-Trivia/issues/4): this team begins with **U**, outside the prompt's explicit **A–M** range. The new triage identifies that *eligibility conflict* rather than indiscriminately accepting a recognizable NBA team.
- [#5 — Cars and Cinderella Man, movies A–M](https://github.com/dokeefe414/Outlier-Trivia/issues/5): titles begin within A–M, but they must actually belong to the specifically curated **256-film historical list**. Missing source evidence means no unverified additions.

For each verified valid submission, use the existing source-cited review and versioned archive workflow. Archive any corrected future questions rather than editing already completed official daily scores.

### 6. Mobile and accessibility

The ready-up screen, presence roster, voting progress, verified season tables, friend comparison actions and history rows use responsive styling down to narrow phone widths. Focus states and contrast remain visible; reduced-motion preferences suppress unnecessary animation. The public quality monitor has dedicated 390px browser smoke tests. All user-supplied names and report text are escaped or inserted as `textContent` in the UI; no credentials are written to static pages.

## Deployment checklist (owner action required)

1. Configure an authorized Supabase project with email Auth and allowed redirect origins for your actual site. The `src/online-config.js` file must contain **only a public URL and anon/publishable key**; never commit a service-role key, admin token, or payment secrets.
2. Apply all existing migrations in order through **019**, then **`20261112002000_v19_room_competition.sql`** and **`20261112002100_v19_exhibition_normalization.sql`** (preserves distinct C/C#/C++ and other symbol-bearing identifiers in source-checked games). Deploy the updated `supabase/functions/outlier/index.ts` with private service-role secrets. Keep Stripe live checkout off unless you separately verify billing.
3. Run `npm run audit:exhibition` locally and generate the opt-in exhibition export. Review historical CC0 scopes, alias collisions, and editorial Fit In weights. Import `private/generated-exhibition-import.sql` to the separate `private.outlier_party_question_bank` and verify `capabilities.partyReady` becomes true. It remains false when the catalog is empty.
4. Validate two authentic accounts on separate devices: join with a spoiler-free invite, both mark READY, host starts, seven shared 45-second rounds, one sealed answer per player/round, final end-only reveal, loss/tie/win, unanimous rematch to a fresh ready screen.
5. Repeat with three and four real accounts. Test last-seen indicators, leaving a waiting lobby, inactive tabs, slow or dropped Wi-Fi, stale invites, auth expiry, reconnect and duplicate answer/vote attempts. Confirm an outsider sees **no membership, match history, points or question keys**.
6. Run `npm run check`, `npm run audit:content`, `npm run audit:exhibition`, `npm run test:browser`. CI must pass Postgres permission/membership tests with disposable fake users and fixture questions. **These tests cannot substitute for production network and mobile testing.**

## Real beta: not yet conducted

Recruit 10–20 consenting players. The [game-night playtest issue form](../.github/ISSUE_TEMPLATE/game-night-playtest.yml) and optional anonymous result copy are ready. Never share account emails, actual invite codes, private answer rows, or credentials. Collect session completion, reconnection failures, false rejects, mobile overflow, clarity of readiness/rematch votes, and return-to-play intent.

Suggested **release targets, not observed metrics**: zero cross-room data exposure, zero changed official daily scores from exhibition, zero rematches without unanimous consent, no lost existing server answer on reconnect, at least 90% of sessions completed, and at least 80% of testers interested in another game. Keep online tournaments unranked until evidence and real users justify stronger claims.

## Developer files

- Database: `supabase/migrations/20261112002000_v19_room_competition.sql` and `supabase/migrations/20261112002100_v19_exhibition_normalization.sql`
- Server API: `supabase/functions/outlier/index.ts`
- Player UI: `src/online.js`, `styles/editorial.css`
- Source pack: `src/exhibition-bank.js`, `scripts/prepare-exhibition-bank.mjs`, `test/exhibition-bank.test.js`
- Public QA: `quality.html`, `src/quality.js`, `src/content-quality.js`, `test/content-quality.test.js`
- Database security: `test/v19-competition-smoke.sql`
- Review triage: `src/review-triage.js`, `test/review-triage.test.js`
- Browser checks: `e2e/browser-smoke.mjs`

**Current platform limitation:** OUTLIER GitHub Pages remains a static website; without a connected, configured Supabase project this source release cannot claim actual live cross-device matches or a completed human beta. The local guest daily, Big List, and Pass & Play experience do not depend on that backend.
