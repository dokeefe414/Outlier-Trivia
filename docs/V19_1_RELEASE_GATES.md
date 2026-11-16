# OUTLIER v1.9.1 — Public Launch Gates & Real Beta Evidence

This is a focused follow-on to the full **v1.9 Inner Circle** feature release. The verified 2–4 player lobby, ready-up, synchronized server rounds, unanimous rematches, friends-only match records/seasonal standings/rivalries, mobile layouts, reviewed exhibition-bank exporter, and public answer-quality monitor were already present in v1.9. **We have not recreated or pretended to activate those features.**

## What this update adds

- A **non-networked deployment readiness preflight** (`npm run preflight:online`) that inspects the public Supabase project config, existence of the protected server-function source, and the required v1.7–v1.9 migrations. Its result distinguishes *static source readiness* from *verified live deployment*. It never prints the public key, attempts to use a secret, makes a network request, or declares online matches live on the strength of CI.
- A **real, anonymous beta-release assessment** (`npm run beta:report -- private/beta-observations.json`) with schema checks, explicit sample sizes, completion and return-intent rates, incident tallies and blocking criteria. This tool cannot manufacture real-world results, validate account uniqueness, or upload telemetry.
- A **new four-person server security regression** covering unanimous ready-up, all-player ties, outsider access isolation, rematch voting, repeat-vote idempotence, a fresh waiting room, and no leaked previous answer/question state.
- Updated README, setup links, release documentation and CI gates.

## Online multiplayer deployment — not completed by public source code

The static site at `https://dokeefe414.github.io/Outlier-Trivia/` still ships a blank `src/online-config.js`. GitHub Pages serves the **free guest daily, Big List and Pass & Play**; it cannot on its own persist authenticated, server-verified cross-device rooms.

To activate the already implemented v1.9 private matches:

1. **Connect or provision an authorized Supabase project.** Configure project email sign-in redirects to the actual public Pages URL. Use only the *public* project URL and publishable/anon key in `src/online-config.js`. Never commit `service_role`, database connection passwords or Stripe keys.
2. **Apply all migrations in chronological order through `20261112002100_v19_exhibition_normalization.sql`**. Run `npm run preflight:online` to inspect local configuration. A successful preflight is not proof that the migrations were applied to a live database.
3. **Deploy `supabase/functions/outlier/index.ts`** with the documented server-side secrets in the Supabase secret store and an appropriate allowed-origin list. Verify real Auth/Edge endpoints with two actual accounts; unauthorized users must get protected errors. Do not enable real billing as part of multiplayer setup.
4. **Prepare the separate exhibition bank:** run `npm run audit:exhibition`, inspect the independently source-bounded 18 rare and 10 editorial Fit In exhibition prompts, then `npm run prepare:exhibition`. Review the output under the gitignored `private/` folder before manually importing it into the dedicated private *room* bank. Never leak the future ranked daily answer bank. Run the backend capabilities check and ensure `partyReady` is true **because that reviewed private room bank is populated**, not because a static page loaded.
5. **Verify a full 315-second live session** on two separate devices/accounts, then repeat with 3 and 4. Confirm presence/ready-up, strict deadline enforcement under clock skew, sealed answers, reconnection, a correct/incorrect/tied score, verified friend rivalry records, unanimous rematch and a fresh ready-up step. Confirm that a nonmember sees no room data. Only after these checks should the game be described as *live*.

`npm run preflight:online -- --strict` returns a nonzero status when verification is incomplete. The nonstrict command intentionally exits successfully so CI can **report the deployment blockers without claiming that the project is activated**. The status includes no project key.

## Human beta program — not yet conducted

The GitHub Issue Forms and anonymous match recap already exist. To evaluate an actual beta with no fake testers or automatic collection:

1. Recruit **10–20 consenting distinct people** offline. Do not include names, email addresses, login tokens, invite codes, guesses, photos or raw answer histories in observation files.
2. Copy `docs/beta-collection-template.json` to a gitignored file such as `private/beta-observations.json`. Set `testerCount` to the number of distinct people **you really observed/consented**, not the number of sessions. For each actual session append one record, for example:

```json
{
  "mode": "private",
  "started": true,
  "completed": true,
  "wouldPlayAgain": true,
  "reconnectFailures": 0,
  "validAnswerRejected": 0,
  "mobileOverflow": false,
  "privacyIncident": false,
  "unauthorizedRematch": false,
  "timerReset": false,
  "officialScoreChanged": false,
  "accessibilityIssue": false
}
```

*This is a schema example, not a claim that this test happened.* Use `mode: "local"` for Pass & Play. Do not add identifiers or extra custom fields; the parser intentionally rejects them.
3. Run `npm run beta:report -- private/beta-observations.json`. The tool returns a JSON report with actual session completion, replay intent and incident counts.
4. **Acceptance criteria:** at least 10 distinct consenting testers **and** 10 completed sessions, at least **90%** started-session completion, at least **80%** of completed sessions with positive replay intent, and **zero** cross-room privacy incidents, unauthorized rematches, unintended timer resets or official-score side effects. Every reported valid-answer rejection requires human source review before a confident release claim. These are *targets*, not observed results.
5. Investigate mobile overflow, accessibility failures and reconnection incidents and link each reproducible problem to the existing [Game Night beta issue form](../.github/ISSUE_TEMPLATE/game-night-playtest.yml). Preserve source attribution and the official daily score archive. Do not publish a progress percentage without real observations.

The final report is **self-reported** and does not prove distinct account identities or absence of fraud; human coordination, a backend event log review and independent app testing remain necessary.

## Code / checks

| Component | Location | Purpose |
|---|---|---|
| Pure preflight logic | `src/deployment-readiness.js` | Source/config versus real deployment evidence |
| No-network preflight CLI | `scripts/check-hosted-readiness.mjs` | Print missing owner setup without credentials |
| Anonymous beta evaluator | `src/beta-release.js` | Validate observations, rates, hard release blockers |
| Offline beta CLI | `scripts/beta-release-report.mjs` | Produce real measurement report |
| Empty example file | `docs/beta-collection-template.json` | No simulated human sessions |
| Four-user SQL simulation | `test/v19-release-gates-smoke.sql` | Confirm consent, tie and rematch security |
| New automated tests | `test/deployment-readiness.test.js`, `test/beta-release.test.js` | Prevent false live claims and invalid metrics |

CI runs Node checks, current content/exhibition audits, Deno Edge type checks, PostgreSQL migrations with disposable user identities and the four-person challenge, plus the mobile/desktop Playwright flow.

## Honest current status

- **Implemented and tested in the repository:** guest game, local championship recovery, answer review/audit tools, authenticated room source code, secure match history and this release-gate package.
- **Not automatically accomplished by a GitHub merge:** deploying or connecting an authorized Supabase account, importing independently reviewed production question content, actual paid service configuration, cross-device live play, real volunteer recruitment or statistically meaningful player satisfaction evidence.
- Once the backend is actually connected and authentic test sessions meet the gates, revise this section with factual evidence and real dates before claiming a public v2.0 launch.
