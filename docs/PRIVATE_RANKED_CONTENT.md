# Curating privately held ranked trivia

OUTLIER v0.7 intentionally does **not** publish a ranked answer bank in
GitHub. The free **guest** game still ships public answer keys because it
must work offline from the static GitHub Pages site. Guest scores are
never proof of fair competitive performance.

## What must be added privately

The Supabase table \`private.ranked_question_bank\` is **empty by default**.
In production, populate the table through a privileged, access-controlled
Supabase SQL editor or secure administration workflow. Do not commit these
question rows to GitHub or a front-end bundle. Do not run
\`test/private-question-fixture.sql\` outside a disposable CI database: it
copies public prototype answers and intentionally defeats secrecy for testing.

Each record needs:
- \`id\`: a random, non-guessable stable identifier (10–100 chars).
- \`kind\`: \`rare\` or \`fit\`.
- \`pool_group\`: one of \`geo\`, \`science\`, \`wild\`, \`movies\`,
  \`tv\`, \`music\`, \`sports\`, \`animals\`, \`food\`, \`games\`,
  \`history\`, \`people\` for rare questions; \`fit\` for crowd prediction.
- \`category\`, \`prompt\`, \`detail\`: safe player-facing text.
- \`answers\`: for rare questions, JSON array of
  \`[canonicalName,integerPoints,[approvedAliases...]]\`.
- \`choices\`: for fit questions, JSON array of exactly six
  \`[displayName,exampleCrowdShareInteger]\` pairs.
- No personal information, copyrighted lyrics, or protected creative work.

**Important:** These example shares are *editorial prototypes*. Actual
observed response frequencies must not change a running daily score.

## Required coverage before enabling online competition

The server's \`outlier_launch_readiness()\` verifies at least:

| Group | Minimum rare prompts |
| --- | ---: |
| Geography | 3 |
| Science | 2 |
| Other classics | 2 |
| Movies | 2 |
| Television | 2 |
| Music | 3 |
| Sports | 3 |
| Animals | 3 |
| Food | 2 |
| Games | 2 |
| History | 2 |
| People | 2 |
| Fit In | 21 |

Total minimum: 28 rare prompts and 21 Fit In prompts (49 distinct
prompts for the seven daily rounds in one UTC week).

For actual public beta quality, prepare significantly more than the
minimum so valid answers are broad and weekly repeats are not frequent.
A dedicated editorial review should check every prompt, accepted name,
alias collision, outdated information, rarity point and source.

## Prelaunch controls

- The server will return \`private_question_bank_not_configured\` until
  a full private bank has been provided. The optional website shows a
  setup-incomplete warning and **does not open a paid checkout** until
  payment and ranked modes are ready.
- An official UTC day is sealed on its first ranked player start in
  \`private.official_daily_slates\`; later content insertion can't
  change the day's exact seven prompts.
- Once an answer key has appeared in an official sealed slate,
  \`private.prevent_published_answer_edits()\` blocks updates and deletes.
  New variants need **new question IDs** scheduled for future days.
- \`private.ranked_question_bank\` and \`private.official_daily_slates\`
  have no direct browser grants. The signed-in Edge Function verifies
  identity before looking up current questions and scoring.
- Publishing question prompts during gameplay is unavoidable; only
  their answers and future question bank remain hidden. Users can
  still search the internet or create extra accounts. This beta
  cannot promise perfectly cheat-proof competition.
- Test anonymous and authenticated API calls to ensure neither can
  retrieve \`private.ranked_question_bank\` answer rows.
- Keep questions in the owner-controlled database, not in untrusted
  repo CI logs, issue screenshots, shared documents or URLs.

## Inspect readiness safely

After deploying Supabase, set a high-entropy admin secret:

    supabase secrets set OUTLIER_ADMIN_TOKEN="LONG_RANDOM_VALUE_AT_LEAST_32_CHARS"

The owner may call the Edge Function with an admin header from a trusted
shell (not from the browser). The \`admin-metrics\` route returns only
readiness/aggregate beta measures:

    curl -H "X-Outlier-Admin-Token: YOUR_PRIVATE_TOKEN" \
      "https://YOUR_PROJECT_REF.supabase.co/functions/v1/outlier?action=admin-metrics"

Ensure no shell history, logs or recordings expose the token.
This endpoint does not return individual questions or user identities.

The public \`?action=capabilities\` endpoint gives only a coarse
\`rankedReady\` flag, a \`paymentReady\` flag and a count. The front end
uses it to hide buttons that can't work yet.

## Reproducible launch checks

Run \`npm run check\` and the GitHub workflow. In a real owner-controlled
Supabase test project, complete two different accounts' daily slates.
Compare IDs, points, and result reveals. Try an invalid alias, an
unambiguous typo, an old game resume, a second account, and a simultaneous
start. Verify you cannot mutate an already-published ranked question or
read question keys through the anonymous or signed-in Data API.

Only call it a **live ranked beta** after these results pass in the actual
hosted project. Source code passing CI alone is not proof of deployment.
