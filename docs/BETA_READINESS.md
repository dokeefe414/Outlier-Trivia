# OUTLIER — Multiplayer beta activation checklist (v0.9)

The public free game works on GitHub Pages; the real online layer is
**not active** with the repository's blank Supabase config. No project
can responsibly claim to have launched real payments or leaderboard
competition merely from passing tests in CI.

## What is implemented

- Secure Supabase Edge Function architecture and account identity
  verification, verified official daily attempts and lifetime stats.
- Worldwide daily/weekly/lifetime leaderboard query functions and
  member-only, invite-code friend leagues.
- A private ranked question table, frozen UTC weekly slates and
  immutable published scoring keys.
- Stripe $4.99 one-time purchase checkout source, entitlement
  restoration, webhook signature verification, refunds and disputes.
- A hosted answer-review intake, per-player status, and private owner
  dashboard at \`admin.html\`.
- Owner-only aggregate beta measurements, server-side request limits
  and historical answer frequency insights.

## What you still need to supply

1. **Supabase:** Create a private project under your control, enable
   email-based sign-in, configure deliverability and apply the migrations
   through \`20261112001200_review_admin.sql\` in filename order.
   Deploy \`supabase/functions/outlier/index.ts\`.
2. **Private ranked content:** Curate sufficient questions whose
   correct answers haven't already been published in this GitHub repo.
   Assign stable \`rq_\` IDs with
   \`node scripts/validate-private-bank.mjs --new-id\`.
   Store the JSON in \`private/questions.json\` and validate with
   \`node scripts/validate-private-bank.mjs private/questions.json --validate-only\`.
   After a complete audit, generate an additive SQL import in
   \`private/generated-ranked-import.sql\` and apply it only to
   your own private Supabase database.
3. **Review admin:** Set a strong \`OUTLIER_ADMIN_TOKEN\` secret in
   Supabase, never in GitHub. Open \`admin.html\` after the public
   Supabase URL is configured. Only the correct private token reveals
   tickets. Manually resolve reports with citations.
4. **Stripe:** Configure a business-managed account, card-based test
   checkout, signed webhooks, refunds/dispute events, one-time
   purchase entitlement recovery, and a documented refund policy.
   Keep \`STRIPE_MODE=test\` until test-mode purchases work end-to-end.
5. **Safety:** Add account deletion and data handling policies,
   public issue moderation, a support contact, source attribution,
   rate-limit/load checks, and accessibility testing.
6. **Closed beta:** Invite 20–50 consenting testers only after the
   readiness endpoint reports a complete private bank. Verify all
   players receive the same sealed daily slate across devices and
   that practice is never ranked.

## Beta success signals

The owner-only \`admin-metrics\` endpoint gives observed official game
completion and day-1/day-7 return rates, with eligible denominators.
Useful proposed early targets: 80%+ completion, 35%+ day-1 return,
15%+ day-7 return and very few wrongly rejected valid answers.
These are goals, **not measured performance**.

Review nicknames and false-positive reports weekly, then decide how
to build a statistically defensible popularity scoring model. A
30-response threshold is only a privacy/data-minimum guard, not proof
that a rare-answer estimate is statistically precise.

## Nonnegotiable operational safeguards

- Never put \`SUPABASE_SERVICE_ROLE_KEY\`, the admin token, Stripe
  secrets, ranked answer keys, or user data in public GitHub.
- Never use the public test fixture as production ranked answers.
- Never publish individual players' raw guesses or private review
  reasons in global rankings.
- Never change a score or answer key in a previously sealed ranked day.
- A human must approve a private question update for future versions.
- Launch does not happen until at least two actual accounts can
  complete and cross-verify the same daily result in the live project.
