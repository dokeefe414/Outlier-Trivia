# OUTLIER — Hosted online league setup

**Current status:** Hosted mode is source code only. GitHub Pages continues to run
the local daily game until Supabase and Stripe are independently configured.
No real accounts, payments, or worldwide rankings are active solely from these commits.

## Architecture

The website has two clearly distinct paths:

- Guest/local play: free seven-question daily game using browser storage.
- Online league: Supabase Auth email sign-in, secure ranked daily attempts,
  Postgres-backed Daily/Average/Total leaderboards and a permanent $4.99 unlock.
- One official online attempt per user per UTC day; paid practice is unranked.
- Server-side answers, timers, score calculation and purchase entitlements.
- A question's 45-second timer starts when that question opens, **not** while
  the player reads the previous answer reveal.

## Connect Supabase

1. Create a Supabase project you control at https://supabase.com.
2. Enable email sign-in in Authentication.
3. Under Authentication → URL Configuration, set Site URL to
   https://dokeefe414.github.io/Outlier-Trivia/ and add redirect URL
   https://dokeefe414.github.io/Outlier-Trivia/?online=1.
4. Install the Supabase CLI and authenticate. From this repository run:

    supabase login
    supabase link --project-ref YOUR_PROJECT_REF
    supabase db push

5. Set the public site origin and deploy the Edge Function:

    supabase secrets set SITE_URL="https://dokeefe414.github.io/Outlier-Trivia/" ALLOWED_ORIGINS="https://dokeefe414.github.io"
    supabase functions deploy outlier --no-verify-jwt

6. Open src/online-config.js and set SUPABASE_URL to the project URL and
   SUPABASE_ANON_KEY to its browser-safe public anon/publishable key.
   Commit that change and let GitHub Pages redeploy.

**Never place a Supabase service-role key or Stripe key in browser code.**
Supabase injects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY server-side.
The public configuration file deliberately contains blank values until setup.

The Edge Function is deployed with JWT gateway verification disabled only
because the Stripe webhook cannot send a Supabase JWT. The function itself
verifies all private requests through Supabase Auth /auth/v1/user and separately
verifies every Stripe webhook cryptographic signature.

## Stripe one-time checkout

The planned product is a **single $4.99 USD lifetime purchase**, not a subscription.

1. Set up a Stripe account you control.
2. In Stripe test mode, add the secret key to Supabase Edge Function secrets:

    supabase secrets set STRIPE_SECRET_KEY="sk_test_YOUR_TEST_KEY"

3. Add a webhook endpoint:
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/outlier?action=webhook
4. Subscribe to checkout.session.completed. Copy its signing secret:

    supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_YOUR_SIGNING_SECRET"

The purchase endpoint creates a hosted Stripe Checkout session at exactly
499 cents. The server verifies the Stripe webhook HMAC, that the payment
status is paid, and that amount and currency match. Only after this does
the purchased lifetime entitlement become active. The success redirect
alone never grants premium access.

Test checkout cancellation, failed payments, duplicated webhooks, restored
purchases across devices and unpaid practice attempts before going live.
Live mode has different Stripe keys and webhook secret. You must complete
merchant, tax, privacy, support and refund setup separately.

## Live API routes

Supabase Edge Function URL:
https://YOUR_PROJECT_REF.supabase.co/functions/v1/outlier

- GET ?action=leaderboard&board=daily
- GET ?action=leaderboard&board=average
- GET ?action=leaderboard&board=total
- GET ?action=profile — authenticated
- PATCH ?action=profile — authenticated, validated display names
- POST ?action=start — authenticated, daily or purchased practice
- GET ?action=state&game=UUID — authenticated, only user's game
- POST ?action=answer — authenticated, correct index and 45-second clock
- POST ?action=advance — authenticated, next clock only on click
- POST ?action=checkout — authenticated, returns hosted checkout URL
- POST ?action=webhook — signed Stripe notifications only

The Edge Function uses service credentials to call locked-down SQL functions.
All question answer keys live in private.question_bank. Attempt rows and
entitlements are protected from direct browser writes by RLS and grants.

## What to test after deployment

- Email sign-in redirect in the same browser and on mobile.
- Two users receive the same seven daily prompts and points.
- Reload preserves the running session, and a second tab cannot restart a timer.
- A duplicate daily attempt is rejected; server, not client, calculates points.
- The following question has no active clock until Next is pressed.
- Daily score resets in UTC; Average requires 10 official days; Total accumulates.
- A $4.99 purchased account can open paid practice, but an unpaid user cannot.
- A free guest run does not become a public leaderboard record.
- Updated display names show in rankings without exposing email addresses.

## Test automation

GitHub Actions executes JavaScript tests, Deno type checks, and a PostgreSQL
16 service against the SQL migrations and a database scoring smoke test.

The CI bootstrap under test/database-bootstrap.sql fakes just enough Supabase
auth schema/roles to run on disposable Postgres. **Never run that bootstrap
against a real Supabase project.** Only apply the migrations in supabase/migrations.

## Prelaunch issues to address

The initial 55-question pool and its population percentages are curated
**illustrative examples**, not measured live rarity surveys. Some of the same
question answers are also still bundled in the offline client. Before a
serious competitive launch, move future ranked questions into a separate
server-exclusive bank, expand content substantially, add abuse prevention,
answer review and appeals, privacy policy, account deletion, rate limits,
moderation and server monitoring. No internet trivia game can guarantee
that people won't look up answers; server scoring prevents score tampering,
not research or collusion.

GitHub Pages remains the free frontend host. Supabase and Stripe are separate
services and may have ongoing costs, including for lifetime purchasers.

## v0.6: friend leagues and answer-review service

After linking a Supabase project and applying the original migrations,
run supabase db push to install the 20261112000600_friends_reviews.sql
migration, then redeploy the outlier Edge Function. The server now supports
member-only invite-code leagues (50 players maximum each), verified weekly
ranking, signed-in game history, moderated answer-review tickets and
prior-day response-frequency summaries (hidden until 30 samples).

The optional hosted features **remain inactive** with blank public config,
and historical frequencies are observational, not an automatic revision
of today's official editorial point values. See docs/COMPETITIVE_UPDATE.md.


## v0.7 launch gate: private ranked questions, Stripe refunds and beta metrics

**Do not launch paid or ranked play using the public v0.5 question seeds.**
After applying migration \`20261112000700_private_ranked_content.sql\`, the
actual online scoring system uses \`private.ranked_question_bank\`, which
is deliberately **empty** in the public migrations. Curate real private
questions and import them securely through Supabase (NOT GitHub or
\`test/private-question-fixture.sql\`). See
[PRIVATE_RANKED_CONTENT.md](PRIVATE_RANKED_CONTENT.md) for the required
groups, minimum 49 question set, readiness API, and slate immutability.
Until this content exists, online daily and checkout buttons stay disabled.

Apply the later migrations in order:
- \`20261112000800_billing_lifecycle.sql\` for durable Stripe event handling.
- \`20261112000900_beta_operations.sql\` for request budgets, readiness checks
  and privacy-safe aggregate beta reporting.

In addition to the existing environment secrets, configure:

    supabase secrets set STRIPE_MODE="test"
    supabase secrets set OUTLIER_ADMIN_TOKEN="LONG_RANDOM_UNIQUE_SECRET_AT_LEAST_32_CHARS"

The \`OUTLIER_ADMIN_TOKEN\` is for owner-only beta reporting:
\`GET /functions/v1/outlier?action=admin-metrics\` with the private header
\`X-Outlier-Admin-Token\`. Never put this token in browser source or a repo.

Subscribe the Stripe webhook to:
- \`checkout.session.completed\`
- \`charge.refunded\`
- \`charge.dispute.created\`

The Edge Function verifies signatures **and** test/live mode, records unique
events through a service-role RPC, and updates entitlements only after
actual paid Checkout sessions. A full refund or dispute for the currently
active PaymentIntent revokes access. Test partial refunds, repeated events,
out-of-order delivery and a subsequent legitimate repurchase.

**Test mode and live mode are separate.** Do not set \`STRIPE_MODE=live\`
or live secret keys until owner policies, tax, refunds, support, account
deletion, monitoring and live-browser tests have been reviewed.

The public \`?action=capabilities\` route exposes a coarse ready/not-ready
flag but not question keys. The optional online page uses it to avoid
offering unusable ranked or payment buttons.

## v0.9 answer review and protected editor workspace

After applying `20261112001000_retry_unrecognized.sql`, apply all
`202611120011*.sql` guest/prototype alias migrations in order, followed
by `20261112001200_review_admin.sql`. The private ranked bank remains
empty until you supply privately curated content.

For the **owner-only** review queue, set a 32+ character
`OUTLIER_ADMIN_TOKEN` Edge Function secret and deploy the latest
`supabase/functions/outlier/index.ts`. The public `admin.html` holds
the token only in memory and sends it as an authenticated header.
The dashboard cannot display tickets while Supabase is unconfigured.
Its new endpoints are `GET ?action=admin-review-queue&status=pending`
and `POST ?action=admin-review-decision`. Decision statuses are
audited. Approved requests are **not** automatically added to
published questions; see `docs/ANSWER_REVIEW_GUIDE.md`.

New account profiles can show a player's own review statuses. The
public free guest game continues accepting verified aliases without
requiring Supabase, and never changes live score tables from admin
review submissions.

Run `npm run audit:content` for guest answers. To prepare **private**
ranked questions, use `node scripts/validate-private-bank.mjs --new-id`
and the process in `docs/BETA_READINESS.md`. Never commit your
`private/` folder.

### v0.9 Unicode matching parity

Apply `supabase/migrations/20261112001300_unicode_normalization.sql`
after the review-admin migration. It aligns hosted approved-name normalization
with the browser for accents, ligatures, ampersands and Pokémon sex symbols.
It does not add missing official ranked answers or alter published scores.


## v1.0 beta candidate: final security and activation requirements

After the earlier v0.9 migrations, apply these **in order**:

1. \`supabase/migrations/20261112001400_v1_content_integrity.sql\` —
   validates every private rare/fit question and prevents a ranked game
   from starting when the bank contains malformed or incomplete records.
   Anonymous clients never receive the hidden keys.
2. \`supabase/migrations/20261112001500_v1_community_metrics.sql\` —
   includes verified last-week friend standings and aggregate owner-only
   answer-rejection/quality metrics.

The optional site now accepts \`?online=1&league=INVITECODE\` invite URLs.
Clicking one does NOT join the person automatically. They sign in and
explicitly choose to join; the code is not sent to unrelated sites.

Stripe checkout has explicit **test/live** readiness checks. For test
checkout use a real \`sk_test_\` key, webhook secret and
\`STRIPE_MODE=test\`. The UI labels it "TEST CHECKOUT · NO CHARGE".
To permit **actual live charges**, the owner must deliberately use
\`STRIPE_MODE=live\`, a matching \`sk_live_\` key, and set
\`OUTLIER_ENABLE_LIVE_CHECKOUT=true\`. Keep that setting absent or false
until you have validated support, privacy, refunds, taxes, account
recovery and a two-account beta. A redirect from Stripe is never used
as proof of payment; signed webhook entitlements are authoritative.

The signed-in user can call \`GET ?action=purchase-status\` to verify
whether their own lifetime entitlement is active. No client-supplied
payment success flag grants unlimited practice. The owner metrics
endpoint includes aggregated \`quality\` totals; it is private and does
not expose raw player responses or private question keys.

See [V1_BETA_PLAYBOOK.md](V1_BETA_PLAYBOOK.md) for the recommended
14-day testing sequence and release checklist.
