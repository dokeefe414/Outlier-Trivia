# OUTLIER v1.10 — Game Night 2.0

**Source release:** November 16, 2026. **Scope:** the existing free guest game, hosted room UX, the existing owner-linked Supabase project and its separate **unranked** exhibition catalog. No new account service, payment service or third-party tracking.

## Executive summary

Version 1.10 is a coordinated multiplayer update, not a redesign of the official daily game. It adds authoritative custom room rules, player-selected question themes, consent-based 1/3/5-game championships, richer final reveals, private earned milestones, and a dramatically larger **130-prompt (88 rare / 42 Fit In)** curated exhibition bank. The generated bank contains **46,797 source-scoped rare-answer slots**; these are valid answer slots across questions, not unique entities or empirical rarity data.

| Workstream | Implementation | Source of truth |
| --- | --- | --- |
| Match rules | 20/30/45/60/90 seconds, 7 rounds, 1/3/5 matches per championship | Postgres room row, Edge API |
| Category voting | One ballot per authenticated member; optional; equal vote counts break alphabetically; newest vote replaces prior | Postgres PK (room_id,user_id) |
| Championship | Unanimous rematches, 1/3/5 games, win-first standings with aggregate point tiebreak | Persisted rematch chain and scores |
| Game presentation | Round tracker, top correct pick, cumulative score timeline, lead changes, comeback/close-finish labels | Finished server-provided response only |
| Personal progression | Six private achievement badges and lifetime exhibition metrics | Authenticated server-side aggregate |
| Answer diversity | Archived finite-scope rare questions + original editorial Fit In mini-games | `buildExhibitionBank()`, owner import |
| Verification | New SQL adversarial smoke + JS unit tests + mobile/desktop E2E + type checks | GitHub Actions |

## Architecture and authoritative rules

**Do not calculate scoring or timers in JavaScript.** The Postgres schema and functions in [`supabase/migrations/20261116000100_v110_game_night.sql`](../supabase/migrations/20261116000100_v110_game_night.sql) are the source of truth. `outlier_party_state`, `outlier_party_answer`, `outlier_party_vote_rematch`, history, seasons and rivalries all evaluate the end of a game using `starts_at + make_interval(secs => 7 * round_seconds)`. One-round deadlines and question indexes use the same room duration. The countdown remains five seconds and the game remains seven rounds.

Existing rooms default to 45 seconds. Old room records are not rewritten with new scores. The optional championship length is one, three, or five games. Only the same authenticated 2–4 members can agree to the next game; the `rematch_room_id` link is generated once under the room row lock. The new game inherits the timer and championship length but **never inherits votes, readiness, sealed responses, scores, or the previous question draw**. When `series_game >= series_length`, the service will refuse new rematches under that series.

**Theme ballots:** only eligible room members can cast a vote while the lobby is open. Vote tally ties resolve by theme name, so all devices see the same outcome. During question draw, prompts in the winning theme have priority among the four Stand Out slots; the remaining three Fit In questions are selected independently. If the bank does not have enough prompts in the preferred category, the generator fills the slate with other archived eligible rare questions. **Any change to the host's timer or series length, or a new theme vote, resets all ready confirmations**. This prevents one member from starting a game after the terms have changed without everyone explicitly readying again.

## Protected API routes

The existing `outlier` Supabase Edge Function continues to verify each logged-in user against Supabase Auth before any private route. It adds:

- `POST ?action=party-config` with `{room, seconds, seriesLength}` — host only, waiting room, validated presets
- `POST ?action=party-theme` with `{room, theme}` — member only, waiting room, validated category
- `GET ?action=party-mastery` — account-scoped completed-room aggregate, no private guesses or opponent identities

The state route returns `roundSeconds`, `seriesLength`, `seriesGame`, `selectedTheme`, aggregate `themeVotes`, the requester's own `myTheme`, and a **membership-scoped** series summary only after the shared timer closes. The ordinary server-side `party-start`, `party-answer`, `party-ready`, `party-rematch` and history operations remain protected.

**Security contract:** `public.outlier_party_theme_votes` is RLS enabled, with table privileges revoked from `anon` and `authenticated`. New `SECURITY DEFINER` RPCs are executable only by the Edge server's `service_role` and still explicitly check the supplied user against membership or ownership. The browser **never** receives the service-role key, secret/hidden answer bank, other players' sealed guesses, or direct database table privileges. CORS is not authorization.

## Content quality and source licensing

The exhibition library now includes source-bounded archival prompts with 28–2,500 answers per question. The full answer set is retained for every included question; the importer **never truncates** a question to make its catalog look larger. Larger 2,500+ record sets stay available in unranked guest Big List rather than slowing server round adjudication. Existing historical prompts are unchanged.

- Historical CC0 Corpora and archived reference lists: [v1.6 source details](V16_UNIVERSAL_ANSWER_ATLAS.md), [v1.5 source details](OPEN_ANSWER_ATLAS.md)
- Additional archived media: August 2026 Wikidata-based production snapshot; sitelinks serve as a rough prominence proxy, not player response rates
- Historic baseball: Chadwick Bureau Persons Register, ODC-BY 1.0; see attribution in the v1.6 document
- 42 original Fit In prompts: openly *fictional editorial preference weights* (31,23,18,12,9,7), not actual surveyed player preferences

A valid answer must appear in that exact question's historical source list and source timeframe. A name can be true in the wider world and still be ineligible for a specific archive-bounded prompt. No generative-AI guess is silently promoted to a correct answer. No unpublished official daily scoring keys are imported.

**Import policy:** The migration does not seed source questions. The owner independently reviews and imports `private/generated-exhibition-import.sql` produced via `npm run audit:exhibition` and `npm run prepare:exhibition`. The SQL is gitignored, uses `ON CONFLICT DO NOTHING`, and does not overwrite existing production answers. Multiple runs must not be mistaken for fresh verified content; source provenance and slot counts should be audited and compared.

## Reveal insights, privacy, and progression

The browser computes descriptive highlights only **after the server confirms the game has finished**:

- Biggest accepted answer by editorial point value, with its submitted player and round
- Cumulative scores over seven rounds; a lead change only counts when the sole leader changes
- A comeback when an eventual winner trailed the highest score after round four
- A close finish when the first-to-second point gap is at most 250
- Series standings derived by the server: wins first, total verified points as a tiebreak

Any shared scorecard is explicitly triggered by a user and contains aggregate score totals only: **no player names, emails, user IDs, guesses, answer keys, invite codes or tokens**. Private achievements are similarly server-reported and never count guest play or official ranked results.

The six initial badges are **FIRST CONTACT** (1 game), **TRIPLE THREAT** (3 wins), **DEEP CUT HUNTER** (5 answers at 850+ points), **HIGH FLYER** (4,500 in one game), **THE REGULAR** (10 completed games) and **INNER CIRCLE LEGEND** (15 wins). They are earned based on immutable completed scores, not client-submitted achievements. Long-range totals are capped to the same most-recent-150-room privacy/performance window as the existing private season view; the UI must not call that cap all-time history.

## Local verification

```bash
npm run check
npm run audit:content
npm run audit:exhibition
npm run prepare:exhibition
npm run preflight:online
npm run test:browser
```

The browser suite requires Playwright and Chromium, and the Postgres smoke tests use a disposable CI PostgreSQL service. GitHub CI applies migrations through 021, runs historical v1.9 security checks, applies the v1.10 migration, exports/imports the source-backed exhibition catalog, and runs `test/v110-game-night-smoke.sql` using synthetic auth identities and simulated room timestamps. This validates deterministic server-clock behavior, rematch caps, membership isolation and permission revocation; it is **not evidence of real email delivery or cross-device play**.

## v1.10.1 — Host-controlled roster size

This additive patch closes the custom-player-count launch requirement without increasing the existing **four-member** safety cap. Migration `supabase/migrations/20261116000200_v1101_target_players.sql` adds `target_players integer not null default 2 check (target_players between 2 and 4)` to `public.outlier_party_rooms`. A backfill preserves any pre-existing waiting rooms that already contain three or four members. Existing finished matches and their scores do not change.

- The **host** can choose exactly 2, 3 or 4 required players while the lobby remains open. The new `POST ?action=party-target` route accepts `{room,target}`; the Edge API verifies a real Auth session and invokes the restricted `outlier_party_target` RPC.
- The database refuses a new target below the current joined roster count. Any accepted change resets all READY confirmations; changing the target cannot silently override player consent.
- `outlier_party_join` rejects users after the configured roster is full (and still rejects unauthorized/expired rooms). `outlier_party_start` requires the **exact** target-player count plus existing unanimous READY, so the host cannot start a three-person lobby when only two have joined.
- `outlier_party_state` includes `targetPlayers` for the lobby UI and a visible player-count badge. The copy/share actions remain invitation-only and do not silently enroll recipients.
- A unanimous championship rematch inherits the target-player setting and the exact original roster while creating **fresh** readiness, votes and sealed responses.
- `public.outlier_party_target` is `SECURITY DEFINER` with its own host check. Its `EXECUTE` permission is explicitly revoked from browser-facing `anon` and `authenticated`, and granted to the Edge `service_role` only. This does not add any new public table grants.

The disposable SQL test `test/v1101-target-players-smoke.sql` checks the default two-player target, a three-player host configuration, premature-start denial, over-capacity denial, guest configuration denial, refusing a target below joined members, clearing READY on a rule change, a completed 3-player game, three unanimous rematch votes, preservation of the target roster through the rematch, and a separate four-player start that fails with only three present and succeeds when the fourth joins. The test uses fake accounts **only inside GitHub Actions**. It is not a substitute for actual three- and four-player cross-device QA.

**Upgrade order:** Apply the additive v1.10.1 migration to the existing Supabase project after the v1.10 migration, deploy the updated `outlier` Edge Function, then publish the frontend. Existing 130 validated unranked exhibition prompts remain unchanged. Roll back the Edge+static code if necessary; avoid removing the column while user rooms might reference it.

## Verified deployment record — November 16, 2026

The owner-linked Supabase project `ljmqtdwcwpatyecxtues` successfully applied migration `outlier_20261116000100_v110_game_night` and deployed the `outlier` Edge Function as **active version 2**. The room catalog was expanded in owner-controlled SQL transactions, without committing the generated SQL or private answers to GitHub. Verified production content totals: **88 Stand Out questions, 42 Fit In, 46,797 rare-answer slots; all rows satisfy the server's validator**. `outlier_party_readiness()` reports `ready=true`.

A live Supabase SQL transaction created a one-account private room, changed its round timer to 30 seconds and series to three games, recorded a SCIENCE theme ballot, and checked the returned private state. The transaction was rolled back, leaving **zero persistent test rooms**. Privacy checks confirmed direct browser reads of the new vote table are denied to `anon` and `authenticated`, while only the Edge server role can call the new private RPCs. The Supabase health advisor reported no findings; its RLS-without-policy INFO notices are expected for deny-by-default tables. No Auth user, score or private match record was altered by this smoke.

The v1.10 pull request [#18](https://github.com/dokeefe414/Outlier-Trivia/pull/18) was merged after all four CI jobs passed. The merge SHA is `a198ce02c459f94daa4ab2f2610b906334b073ed`, and [GitHub Pages successfully deployed that merge](https://github.com/dokeefe414/Outlier-Trivia/actions/runs/43974726553). Main-branch CI for the merge is separately monitored. External HTTP `capabilities` responses and real second-device Auth/login/gameplay were **not independently observed**, so do not claim fully player-tested online multiplayer. The next required acceptance task remains [Issue #17](https://github.com/dokeefe414/Outlier-Trivia/issues/17).

## Deployment order and compatibility

1. Merge only after CI is green and the migration/source diffs have been reviewed.
2. On the existing owner-linked Supabase project, apply the reviewed v1.10 migration **once**. Do not reset the database, modify existing profiles/attempts, or introduce new public grants.
3. Deploy the reviewed `supabase/functions/outlier/index.ts` Edge Function with `verify_jwt=false` as currently designed; protected routes must continue to call `currentUser(req)`. No service-role secret belongs in static pages.
4. Import the vetted unranked exhibition SQL in small verified batches if necessary; compare total bank counts, row validation, and anti-exposure checks.
5. Publish updated static GitHub Pages source. Existing guest daily/Big List/Pass & Play must continue to load and score identically.
6. Use two **different consenting accounts and devices** to test email redirects, joining, votes, consent resets, timer presets, reconnect and correct end-of-game timestamps, highlights, the completed championship, access isolation and match history. Repeat with 3–4 accounts.
7. Record anonymized real-player beta results (10–20 testers) using the existing template. Do not mark the launch as fully verified until those observations exist.

## Failure modes and rollback

- If a browser still has an old app version, it should render a basic room without customizing settings. Default 45-second legacy rooms remain server-owned.
- If new SQL functions are missing, the new Edge routes will return a generic server error, not fabricate score data. Restore the prior compatible Edge Function or complete the migration before advertising the new UI.
- If a new content import fails, leave existing 28 exhibition questions intact and retry **only the failed new rows**. Never delete a production bank merely to retry an import.
- If the public site stops loading, redeploy the prior known-good Pages SHA. Leave the existing Supabase project and player data intact.
- Do not manually override immutable finished-match scores or RLS/privileges to clear errors. Inspect scoped logs and rerun the disposable integration tests first.

## Human beta is still required

Real email flows, 2-account mobile/desktop play, privacy isolation from a distinct outsider account, start/late submit boundaries, reconnection from interrupted internet, reduced-motion usability and human replay interest cannot be verified from database fixture tests alone. See [the real-device issue](https://github.com/dokeefe414/Outlier-Trivia/issues/17) and do not mark its human tasks completed without observed data.
