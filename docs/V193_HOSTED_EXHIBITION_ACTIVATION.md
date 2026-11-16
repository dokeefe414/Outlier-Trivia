# OUTLIER v1.9.3 — Hosted Exhibition Activation and Real-Player Launch Gate

**Date:** November 16, 2026. **Deployment scope:** existing Outlier-Trivia Supabase project (no new project or production billing). **Current public site:** https://dokeefe414.github.io/Outlier-Trivia/

## Changes made

- Imported the independently sourced exhibition bank from the exact archived CC0 lists already used by the guest game: **18 Stand Out** questions and **9,748 source-scoped answer slots** (verified counts).
- Imported **10 Fit In** questions from the game's authored editorial examples, each with six choices and weights **31, 23, 18, 12, 9, 7**. These are **not measured player-popularity data**.
- Left the separate private *ranked daily* answer bank untouched; no Stripe/billing configuration was changed.
- Confirmed Supabase Auth contains **one registered account** (no emails or identifiers logged here).
- Confirmed a one-account private room can be created and read through the database's protected RPCs. That test was performed inside a transaction and rolled back; **zero test rooms persisted**.
- Improved private lobby invitation UX: copy-link confirmation actually appears within the room, a phone can invoke the native share sheet (with clipboard/manual-link fallback), and the play screen shows a seven-round progress track. Server clocks, scoring, RLS and room membership were not changed.

## What is and is not live

The question-count prerequisite for private games is satisfied, so the Edge Function's public `capabilities` logic should now calculate `partyReady=true`. The backend function was already deployed; **the actual public HTTP response and complete browser gameplay could not be independently verified from this environment**.

The owner's report of successful email login and the registered user count are encouraging but do not verify a second independent sign-in, a valid login callback on different browsers, or a completed game.

The public, free guest game remains independent of login. Online exhibitions are unranked. Official ranked daily play and Stripe remain gated.

## Exact real-device acceptance test (required before public multiplayer announcement)

1. Open https://dokeefe414.github.io/Outlier-Trivia/?online=1 on a phone and a separate desktop or second phone. Sign in to **two different consenting test accounts**. Ensure each returns to the expected online hub. Never exchange passwords or email magic links.
2. With account A, create a private room, choose **SHARE INVITE** or **COPY INVITE LINK**, and send it to account B. Verify no join occurs without explicit acceptance.
3. Both accounts mark **READY**; confirm host cannot start before both are ready. Then start the match. Check the synchronized 5-second countdown and 7 × 45-second server rounds.
4. Submit one correct rare answer, one invalid answer, one Fit In choice, and one skipped answer from appropriate players. Verify scores stay secret during the match, double submissions are refused, and the seven-step round tracker never changes scoring.
5. Simulate a refresh or connection interruption on one device. The owner of the account should recover their room without resetting the server clock or disclosing other players' sealed answers.
6. After the last round's server deadline, verify the final reveal, correct win/tie/loss totals, private history, and **unanimous rematch**. Repeat with 3–4 accounts when available.
7. Log out and try the invite as a non-member or different account. Private room state, answer keys, and opponent histories must not be readable. Do not publish invite codes, bearer tokens or user emails.

**Known limits:** Test fixtures do not prove real Auth email delivery, real mobile networks, or user satisfaction. The existing sample question bank is source-bounded and fixed; repeat play may reuse prompts. Rarity/choice scores are editorial, not empirical crowd frequencies.

## QA commands

```bash
npm run check
npm run audit:content
npm run audit:exhibition
npm run test:browser
npm run preflight:online
```

Node 20+ is required. The Playwright browser smoke test requires Playwright and Chromium installed. PostgreSQL integration smoke tests run in the repository's CI, not against real user accounts. `preflight:online` checks repository configuration, not the hosted endpoint or emails.

When testing with a small consenting group, collect anonymized results using the existing playtest issue template and `npm run beta:report -- private/beta-observations.json`. Never invent tester data or claim the beta release thresholds have been met.

## Release criteria

- 2 distinct real accounts complete a full cross-device room; follow with 3–4 players
- Every match remains membership-guarded; unknown callers cannot query rooms or raw answers
- Match clock, rematch consent, and account history behave correctly after reconnect
- Mobile invite/share controls are usable, keyboard and reduced-motion paths remain accessible
- CI browser/Node/Postgres checks pass and no unrelated guest behavior regresses
- Only after the real-player beta meets the documented completion and replay-interest targets should hosted multiplayer be announced as fully validated

No custom domain change is necessary for this release.
