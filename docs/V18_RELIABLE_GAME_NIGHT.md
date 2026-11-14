# OUTLIER v1.8 — Reliable Game Nights, Better Answers & Beta Readiness

v1.8 improves the **deployed static guest experience** and prepares (but does not independently activate) secure hosted multiplayer. The public `src/online-config.js` still has no Supabase project URL or publishable key, and the server-side exhibition-only question bank must be populated separately. **No live online rooms, accounts or real-world beta recruitment were provisioned through this release.**

## 1. Pass & Play saves and resumes

- A new `outlier-party-v2` localStorage checkpoint records a **versioned game ID**, the 7 **question IDs per match**, 2–8 player names, selected topics and timer/wager settings, each sealed answer already submitted, each player's pending stake, the current player/round, and the actual existing question deadline.
- **No enormous answer atlas is duplicated** in the save. On resume `src/party-persistence.js` resolves the question IDs against the known bundled question bank and rejects missing/corrupt/unsupported saves.
- The homepage and practice picker show **RESUME GAME NIGHT** when a valid save is present, alongside its stage without spoiling any score, answer or stake. Explicit discard requires confirmation. Starting a brand-new showdown also confirms before replacing an unfinished one.
- Recovery works from ready, live question, answer-sealed, handoff, final wager, reveal, game-score and champion stages. **A question timer is based on its original wall-clock deadline** and does not grant extra time after reload; if the deadline passed while the device was off, the question resolves as a skip.
- Finished series move to a bounded local list of **12 championship summaries**: names, series wins, points, game totals, and settings—**not full answer histories**. A rematch from history restores the exact house rules and names with new questions.
- Checkpoints expire after 45 days and belong only to this device/browser profile. Clearing site data or using private browsing may lose them. Anyone with access to this browser's developer tools or local storage can inspect its unranked local data; the screen's sealed handoff is a social-game convention, **not cryptographic protection**. Do not use it for competitive money or real-world stakes.
- Neither checkpoint nor party history changes official daily records, online scores, purchases, category XP, streaks or leaderboards.

## 2. More helpful, restrained answer recognition

`src/answer-intelligence.js` now recognizes these equivalences **only when they map to exactly one existing approved name/alias for the current question**:

- Optional initial **The** in a proper name/title, with two bounded passes for combinations.
- `St.` / `Saint`, `Mt.` / `Mount`, `Ft.` / `Fort` at the beginning of names.
- Terminal `Jr.` / `Junior` and `Sr.` / `Senior`.
- `Last, First` vs. `First Last` for two-field comma-separated name inputs.
- Existing Unicode folding, normalized punctuation, verified aliases, and strict one-edit unambiguous typos remain active.

A real exact-match name wins first. If multiple approved names match a transformed spelling, the game rejects it as **ambiguous** and asks for a more specific answer. There is **no** generic surname-only guessing, LLM adjudication, unsourced factual acceptance or retrospective rescoring.

`src/review-triage.js`, `npm run audit:proposals -- candidates.json` and `test/review-triage.test.js` support source-driven editorial review of up to 250 **already submitted** candidate reports. Triage flags known accepted aliases, duplicates, missing evidence, unknown questions, ambiguity, or **ready for human review**; the latter is *not approval*. A credible source and a substantive explanation are required, and no code path silently publishes candidate answers.

### Existing public issue triage (not automatically published)

At the time this work was prepared, open GitHub reports include [#1](https://github.com/dokeefe414/Outlier-Trivia/issues/1) (Zendaya), [#3](https://github.com/dokeefe414/Outlier-Trivia/issues/3) (Avril Lavigne spelling), [#4](https://github.com/dokeefe414/Outlier-Trivia/issues/4) (Utah Jazz in an A–M prompt), and [#5](https://github.com/dokeefe414/Outlier-Trivia/issues/5) (film suggestions). **None of these reports supplied an authoritative public source URL in the issue body**; the A–M eligibility of any proposed team is especially important. The editor must verify the *specific question wording and source snapshot*, not just whether the entity exists. Do not auto-close or auto-add any of these reports.

## 3. Private-room reconnection

The online room client now saves only `{version,userId,roomId,savedAt}` under `outlier-online-room-v1` after authentication. It keeps no invite code, secret, response, answer key or score. The pointer expires after two hours and is **strictly tied to the authenticated user**. On opening online play again, it attempts to rejoin that already-authorized room.

A transient network error, busy response, or temporary token failure **does not erase the local pointer or reset the server clock**. The page displays a reconnection status, continues a client clock derived from the last server response, and retries with bounded backoff. When the server definitively rejects membership or the room is gone (403/404/410), the client removes the pointer. Polling pauses when the tab is hidden and resynchronizes on return; the database remains the only authority for whether a deadline has passed.

The new database function `public.outlier_party_readiness()` and Edge `capabilities.partyReady` flag independently check the separate private room catalog (minimum four validated rare questions and three Fit In questions). **Online exhibitions no longer depend on official daily ranked readiness**, which is a different security and content problem. Migration:
`supabase/migrations/20261112001900_v18_party_readiness.sql`.

### Deployment is still owner-managed

1. Provision your Supabase project, Auth redirects, service-role Edge secrets, and correct public URL/anon key. Never commit private tokens.
2. Apply all prior Supabase migrations in chronological order, including **018 and 019**. The online server's deployed Edge function must match `supabase/functions/outlier/index.ts`.
3. Author and verify a **separate room-only** private catalog. The production room bank starts empty; do not copy unreleased ranked daily content. Confirm `outlier_party_readiness` reports ready.
4. Test 2, 3 and 4 genuine accounts on separate devices over a complete 315-second match. Confirm denial of outsiders, host-only start, expired rooms, one answer per round, hidden scores, negative/positive responses, reconnect, and verified final scoreboard.
5. Hold an initial private beta before public announcements. **No remote matches or production secrets were activated by adding this code to GitHub Pages.**

## 4. Practical beta and visual polish

- Local showdowns now use high-contrast recovery cards, responsive champion history, stage transitions and final-winner motion. `prefers-reduced-motion` removes decorative animation, and keyboard focus outlines remain visible.
- Players can **copy an anonymous playtest summary** at the champion screen. It includes player count, series length, timer/wager setting, average scores and final margin—**no names, submitted answers, question IDs or room codes**. Sharing requires explicit copy/paste.
- **Report Game Night Issue** opens a GitHub Issue Form that asks for a platform/browser, game mode, player count, issue reproduction and feedback. It explicitly discourages sharing personal or secret content. No analytics or gameplay logs are silently uploaded.

### 10–20 player beta checklist — pending actual volunteers

Gather at least **10–20 real volunteers** (do not simulate them or claim test results). Run 2-, 3- and 4-player local matches, at least one 5–8-player marathon, 20-second speed rounds and 90-second rounds, optional stakes (including one correctly answered and one missed final question), cross-browser refresh on every stage, 320px phones, screen-reader/keyboard-only operation, and a same-settings rematch.

**Success gates (targets, not measured outcomes):** ≥90% of started matches complete; 0 lost valid saves; 0 private account or answer-key leaks; 0 unintended timer resets; 0 official-daily changes from unranked play; unambiguous source-cited answers only; ≥80% of testers say they would play again. Log issues in the GitHub form. Do a second pass after fixes.

For *real* online rooms, run a separate 2–4 account beta covering poor Wi-Fi, airplane-mode reconnection, duplicate submissions, auth expiry, device clock skew, reloading after final round, sharing an old invite, and host-only rules. Do not count CI fixtures as human user testing.

## Verification

Run `npm run check`, `npm run audit:content`, `npm run test:browser`. CI tests the real browser's save/resume path, answer spellings and review triage, guarded URL recovery and transient-failure behavior, secure Postgres room state, and the separate room readiness migration with an **empty production bank** followed by disposable test-only answer fixtures. Inspect the four CI jobs before merging.
