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
