# OUTLIER v1.0 beta candidate — launch playbook

**Current state:** The static GitHub Pages game can be played immediately.
The Supabase/Stripe multiplayer systems are implemented in source but **not
deployed or activated**. This release makes those optional systems safer,
more useful and easier to test; it does not create customer accounts, charge
cards, populate private answer keys or recruit users automatically.

## The six v1.0 workstreams

### 1. Real accounts and worldwide competition

The optional Supabase Auth sign-in, cross-device profile, four verified
global boards (daily, weekly, official lifetime average, official lifetime
total), and server-enforced one-daily-attempt rule are preserved. v1.0 adds
a **content-quality launch gate** checked by the ranked server before
starting a game. A row count alone no longer qualifies the private bank.

Every rare-answer question must have at least 20 structurally valid approved
answers, 1–1000 integer point scores, and non-conflicting canonical/alias
normalizations. Each Fit In question needs six unique eligible options with
integer prototype shares totaling 100. All 13 content groups must meet
minimum coverage. Until every row passes, ranked play returns the
private-question-bank-not-configured error, and the UI describes the
service as unavailable instead of creating unverifiable results.

### 2. Private question library

Privately prepared content lives in Supabase's
\`private.ranked_question_bank\`. Public browser prototype answers remain
separate; using them for global competition would make answers inspectable
in the GitHub source. The ranked weekly slate is sealed together on the
first official game of that UTC week, and published question records
cannot be edited. Correct errors through new question IDs and future
slates, not silent edits to old leaderboards.

The \`private/\` folder is gitignored. Use
\`scripts/validate-private-bank.mjs\` locally to validate owner-authored
questions and create a local import. **Do not run the public CI fixture
as your production ranked content.** Passing local test coverage does
not replace human review of sources, aliases and game balance.

### 3. Friend leagues and sharing

The optional hosted league UI now supports:
- Private invite URLs preserving the GitHub Pages path.
- **Consent-based joining**: following an invite does not enroll anyone.
  The invited person signs in and explicitly selects Join.
- A weekly **current leader** (not a premature winner), and an actual
  **last-week champion** view after the UTC Sunday end.
- Today, This Week, Last Week and All-time standings. All scores come
  from verified official completed daily attempts. Unranked practice
  has no impact.
- Spoiler-free score shares that never include correct answer keys.
  Invite URLs are bearer codes; people should share them only with
  intended friends, and league owners should moderate membership.

These are active features **only once Supabase is connected**. The
existing free guest Beat My Score link continues to work independently,
but guest results must not be described as server-verified.

### 4. Mobile/game polish

Clearer keyboard focus after answers, score announcements for assistive
technology, stronger visible focus indicators, smoother screen
transitions, responsive invitation cards and a reduced-motion fallback
improve the experience. The four-step intro, Rare Rush/Quick Hit,
Answer Explorer, achievements, cosmetics and daily retry-until-valid
behavior remain intact. Timer expiry and deliberate Skip still finish
each question.

### 5. Evidence-driven closed beta

The owner-only dashboard now includes completed-daily rate, first-day
and seven-day cohort retention (with eligibility denominators), and
aggregate rejected-guess/affected-game totals. The latter indicate
where fairness needs investigation, **not** that every rejected answer
is correct or that the percentage is a population statistic. Manual
review remains the source of truth.

Suggested **14-day opt-in beta**:
1. Days 1–2: verify migration order, current UTC slate identity across
   two accounts, permissions, answer aliases, logout/re-login and
   passwordless email delivery on desktop/mobile.
2. Days 3–5: invite 20–50 consenting testers; test account creation,
   at least three private leagues, invite consent, and the weekly board.
   Keep test payments disabled or clearly in Stripe test mode.
3. Days 6–10: review unrecognized answers against published sources,
   monitor completion rate, fix mobile defects, and measure how many
   testers come back. Publish corrected questions as new future IDs.
4. Days 11–14: confirm weekly champion results after UTC reset,
   review return-rate cohorts only after they become eligible, validate
   privacy/accessibility/moderation and decide go/no-go.

**Exploratory targets** (not measured achievements): 80% daily-game
completion, 35% next-day return, 15% seven-day return, and as few
verified wrongly rejected answers as possible. Counts from a 20–50
player beta have wide uncertainty and cannot support sweeping claims.

### 6. One-time $4.99 purchase

The intended product stays **$4.99 once for lifetime unlimited unranked
practice**. One official daily is always free. There is no subscription
and paying does not affect rank, rarity points, or league standing.

v1.0 adds a **server-side payment-mode gate**:
- Test checkout requires a real Stripe \`sk_test_...\` key, a
  \`whsec_...\` webhook secret and a safe website URL. The UI labels
  this **TEST CHECKOUT — NO CHARGE**.
- Live checkout additionally requires \`STRIPE_MODE=live\`,
  a real \`sk_live_...\` key, configured webhook and the explicit
  secret \`OUTLIER_ENABLE_LIVE_CHECKOUT=true\`. Do not enable it
  until you have reviewed tax/refund/support/account policies.
- Neither type of checkout opens until the private ranked bank is
  healthy. A success redirect is **not proof of payment**.
- The player can use **Check / Restore Lifetime Access** to query
  the server for their own entitlement; the browser never grants
  benefits from a query string or user-submitted receipt.
- Existing signed webhook idempotency, full refunds, disputes, and
  newer legitimate purchases remain governed by the database.

There is no active merchant configuration in this public repository;
no customer can be charged through the unconfigured public site.

## Operational go/no-go checklist

- [ ] Owner-controlled Supabase project created; correct CORS origins,
      OAuth redirect settings, auth email deliverability and auth keys
- [ ] All migrations applied through \`20261112001500_v1_community_metrics.sql\`
- [ ] A separate, human-reviewed private question set imported and
      \`?action=capabilities\` returns \`rankedReady:true\`
- [ ] Anonymous Data API cannot list private answers, answer-review
      audit logs or payment entitlements
- [ ] Two real accounts play exactly the same 7-question daily;
      answer/timer decisions remain server-authored
- [ ] Same users join leagues through an explicit invitation,
      with no outsider able to read other leagues
- [ ] Previous-week champion and official-only boards verified
- [ ] Test-mode Stripe checkout, duplicate webhook, partial/full refund,
      dispute, login restoration and repurchase verified
- [ ] Moderator checks a rejected-answer ticket and creates a new
      versioned question for a future day, without changing old scores
- [ ] Privacy policy, account deletion and retention procedure,
      refund/support contacts, age eligibility and incident response
      reviewed before inviting the public
- [ ] Live checkout enabled **only by explicit owner decision**
- [ ] Real beta users consented; feedback and moderation available

## Deployment sequence

1. Follow [ONLINE_SETUP.md](ONLINE_SETUP.md).
2. Apply migrations in filename order. v1.0 introduces
   \`20261112001400_v1_content_integrity.sql\` and
   \`20261112001500_v1_community_metrics.sql\`.
3. Populate/validate **private** ranked content; never copy public
   demo answer keys into the production bank.
4. Deploy the Edge Function and configure auth, site URL,
   \`OUTLIER_ADMIN_TOKEN\`, Stripe test secrets and allowed origins.
5. Add only the public Supabase URL and anon key to
   \`src/online-config.js\`; never commit service-role or payment keys.
6. Perform a two-account closed beta, then separately opt into live
   payment mode when all launch gates have passed.

## What is still genuinely unfinished

Real Supabase and Stripe provisioning, unpublished/private question
authorship, actual real-user beta measurements, support operations,
moderation, account deletion and release monitoring. Code is not a
replacement for these people and services, so they are not described
as activated or completed.
