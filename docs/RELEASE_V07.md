# OUTLIER v0.7 — Public Beta Readiness

**Released code is not equivalent to a launched online service.** The hosted
account, payment, and global competition systems remain inactive with empty
\`src/online-config.js\` values. Guest daily and practice games remain free
on GitHub Pages.

## The biggest improvements

**First impressions:** a four-step interactive tutorial teaches the 4 Stand Out
+ 3 Fit In format, estimated rarity, example crowd shares, time limits and
daily reset. It appears once for first-time guest players, is skippable,
and can be replayed from the home beta checklist.

**Earned, never purchased:** Four personal cosmetic themes are unlocked only
from **completed official daily games**: Nebula (starter), Aurora (3 days),
Sunset (7 days), and Champion (14 days). Themes do not modify question
selection, scores, timers, or leaderboards.

**Weekly seasons:** Monday–Sunday UTC progress displays Rookie (1 daily),
Contender (3), Ace (5), and Legend (7) cosmetic badges, recent season archive
and progress toward the next badge. No rewards depend on spending or
unranked practice. Weekly totals never change global leaderboard rules.

**Beta feedback:** a GitHub issue-form workflow asks for reproducible bugs,
sources for rejected answers and suggestions. No client analytics, answer
histories, or emails are appended to feedback links. Submitting GitHub
issues requires a GitHub login. Never paste payment details or private
invitation codes.

## Ranked answer secrecy

Earlier versions shipped all accepted answers in public JavaScript and public
migration files. Those remain necessary for **offline guest play** and historical
prototype tests. A real-money or competitive service **cannot** trust them.

v0.7 therefore introduces a separate, **empty-by-default**
\`private.ranked_question_bank\` in Supabase. Its accepted answers and keys are
**not shipped** in this public repository.

- The server must be populated with separately curated, privately held ranked
  questions before the online feature can open. It returns
  \`private_question_bank_not_configured\` until configured.
- The schema requires a coverage of **28 rare and 21 Fit In prompts per UTC
  week**. The validator checks the required category coverage.
- Official slates are permanently **sealed** at first play for each UTC
  date. An updated content pool cannot change that day's shared seven.
- Ranked question records that have ever been used in an official slate
  are immutable. To correct a known error, publish a new question ID for
  future schedules and resolve the old answer via a reviewed correction
  process. Scores are not retroactively changed automatically.
- Browsers receive only the current prompt, type, approved Fit In option
  labels and timer deadline; correct answers, rarity values, and future
  questions remain server-only. Post-answer reveals are allowed.
- Offline guest practice continues to use the public question bank.
  **Guest scores are never globally verified**.

**Private content authoring is a deployment prerequisite**, not something
that can safely be completed by committing secrets to the repository.

## Friend leagues and rankings

The v0.6 private-invite leagues, weekly ranking, signed-in historical
scores and rejected-answer review inbox remain available in the optional
backend. Review tickets are limited and require a rejected answer from
the requester's own game. Public leaderboards use server-calculated
daily points only. Cosmetics and premium practice never count.

Historical response samples (prior completed official games) are visible
only after a threshold of 30 responses for that question. These are
early observations, not reliable population frequencies. Editorial
rarity points remain frozen until a separately evaluated model is ready.

## Billing safety

A one-time $4.99 checkout is prepared, with no recurring subscription.
The billing flow now includes:

- Stripe-signed webhooks checked against the configured test/live mode.
- Unique event IDs for replay protection.
- PaymentIntent-linked entitlements and receipt reconciliation.
- Full-refund revocation, partial-refund retention, and dispute revocation.
- Out-of-order webhook handling so a late purchase event cannot undo a
  previously recorded full refund for the same PaymentIntent.
- A new, later valid purchase may restore premium after a refund or dispute.
- Unverified success redirects never unlock premium.

This is a **testable implementation**. It is not an authorization to take
live payments. The project owner must create a Stripe merchant account,
configure secrets, validate tax/support/refund policies, and run test-mode
end-to-end exercises before opting into live mode.

## Beta measurements (server-only)

The hosted owner can read anonymized aggregates using a long
\`OUTLIER_ADMIN_TOKEN\` supplied as an Edge Function secret, not in GitHub.
The admin endpoint reports:
- Number of users with completed official daily games.
- Total started/completed official attempts and completion percent.
- Eligible and retained day-1 cohorts.
- Eligible and retained day-7 cohorts.

It does **not** report any unverified guest data, player identities,
email addresses, or raw answers. Return rate denominators exclude
cohorts that have not reached the required number of days.

Recommended initial beta: invite **20–50 opt-in testers**, verify that
their daily question slates match, and test desktop/mobile and re-login.
Useful early goals to investigate are 80% daily completion, 35%
day-1 return, 15% day-7 return and minimal wrongly rejected answers.
These are **targets**, not results or promises.

Before public marketing, check privacy and account deletion procedures,
high-volume auth email deliverability, request limits/abuse monitoring,
content moderation, support and refund policies, payment taxes, server
uptime and accessibility.

## Deployment order

1. Link an owner-controlled Supabase account and apply all migrations,
   including 00700 (private ranked content), 00800 (billing lifecycle),
   and 00900 (beta operations).
2. Generate a genuinely private ranked question set, freeze its points,
   and import it only to the Supabase private schema. Never use
   \`test/private-question-fixture.sql\` in production.
3. Check private coverage using the admin readiness endpoint (see
   \`docs/PRIVATE_RANKED_CONTENT.md\`).
4. Deploy \`supabase/functions/outlier/index.ts\` and configure site
   origins and production email delivery.
5. Set Stripe test keys, signed webhook endpoint, \`STRIPE_MODE=test\`,
   and a strong \`OUTLIER_ADMIN_TOKEN\`. Verify payment/refund/dispute.
6. Add **public** Supabase URL + public/anon key to
   \`src/online-config.js\`, redeploy GitHub Pages and test two distinct
   players and a private league.
7. Only after security, content, payment and user testing should the
   owner explicitly switch to live Stripe keys and \`STRIPE_MODE=live\`.

The GitHub CI job checks JavaScript units, a real headless mobile/desktop
game, Deno type safety, Postgres migration permissions, private content
readiness, schedule sealing, score integrity, rate limiting, and payment
webhook event bookkeeping. CI's synthetic private question fixture is
clearly marked **test-only**.

## Still not production complete

A reliable payment billing dashboard, human-reviewed scoring corrections,
account deletion flows, moderation/reporting, broader private question
curation, real user testing and incident monitoring are separate work.
Deploying code without accounts, reviewed content and these operations
does not deliver a production-ready multiplayer game.

The priority is to give OUTLIER a fair and enjoyable beta, **not**
prematurely imply that account/payment services are live.
