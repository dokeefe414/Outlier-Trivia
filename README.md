# OUTLIER — Outthink the crowd

**A playable, mobile-friendly daily general-knowledge game.** Seven questions, two mindsets: find a rare correct answer in **Stand Out**, then predict the most popular answer in **Fit In**.

> **Prototype v0.3 (online backend optional).** This is a static front-end prototype, not yet a production competitive service. No payments, accounts, or worldwide leaderboards are active.

## Play

Open the site using a local HTTP server or publish this repository using **GitHub Pages**.

### Local development

No installation, framework, API key, or build step required. Node 20+ is only needed for tests.

Using Python (Windows / macOS / Linux):

    python -m http.server 8000

Then visit **http://localhost:8000**. Use the Windows command **py -m http.server 8000** if your Python command is **py**.

The browser must load the site over HTTP, not the file protocol, because the game uses JavaScript ES modules.

### GitHub Pages

1. In this repository, choose **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select **main**, **/(root)**, then **Save**.
4. Once GitHub finishes deploying, the expected URL is **https://dokeefe414.github.io/Outlier-Trivia/**.

Pages is **not enabled automatically** by these commits, and the expected URL should not be considered live until deployment succeeds.

## Online league upgrade (v0.3)

The existing free local seven-question daily game continues to work with no accounts.
This update also introduces an **optional, deployable hosted mode** with:

- Email sign-in through Supabase Auth, editable public display names.
- Daily, lifetime average (minimum 10 completed days), and lifetime total global rankings.
- Server-authoritative 45-second timers, one official daily attempt per account and answer validation.
- Separate unranked unlimited practice with a **single $4.99 lifetime purchase** entitlement.
- Secure Stripe Checkout creation and signed webhook payment verification.
- Real account stats, a live leaderboard page and a mobile-friendly online game flow.
- A CI PostgreSQL smoke test, Deno API type checks, and strict server/private question separation.

**Online mode is NOT active by default.** It requires the project owner to connect a
Supabase project and Stripe merchant account, deploy the server, and add the
public anon/publishable config. No real payments are collected by the current
unconfigured GitHub Pages website. See [Online setup](docs/ONLINE_SETUP.md).

**Security boundary:** guest scores stay in the browser and never enter official
leaderboards; only authenticated server-validated games are ranked. Hosted
practice requests are checked against verified lifetime entitlements.

## Friend challenges and knowledge DNA

Even before hosted accounts are connected, a daily result now includes a **Beat My Score** URL.
Friends opening a same-day link see the score to beat and get a clear comparison
on their results screen. Links include only the target score and UTC day, so they
don't spoil any of the seven answers. Shared targets are friendly invitations,
**not independently verified ranks**. They expire for fair same-question play
at the next UTC day change.

The local My Stats page now includes a **Knowledge DNA** category breakdown.
It shows your own average points per question by category based only on
completed official guest dailies; practice never affects it.

## Gameplay

- One **official daily game** per UTC calendar day, with identical questions and presentation order for all visitors.
- Seven rounds in a fixed alternating pattern: **Stand Out, Fit In, Stand Out, Fit In, Stand Out, Fit In, Stand Out**.
- **Stand Out (four rounds):** Type an answer from a finite, curated list. Correct answers earn **100–1,000** points according to fixed prototype rarity tiers. The question tells the player how many valid responses exist.
- **Fit In (three rounds):** Choose among six plausible responses. Try to select the most popular response on the **pre-set prototype crowd board**. Points scale relative to the highest-ranked response. The top response earns **1,000** points.
- **45 seconds** per question. The timer does not change points. Skips and timeouts earn zero.
- Round-by-round result reveals, animations, optional tiny sound effects, shareable spoiler-free score cards, and **0–7,000** total possible points.
- A **visual timer bar**, keyboard shortcuts (**A–F** or **1–6**) for Fit In questions, and richer score breakdowns by mode.
- A **seven-day activity calendar**, current streak, personal achievements, and eight unlockable badges. All are derived from **official completed daily records** stored in the current browser.
- **Practice mode:** Unlimited replays *for testing during the prototype*. Scores are unranked and never affect official statistics.
- **Local stats:** Completed daily games, lifetime average, lifetime total, and personal best, saved in the current browser's localStorage. Refreshing the page resumes an in-progress daily attempt, and finishing a day locks that browser's official attempt.

## Prototype upgrade notes

The weekly rotation uses 32 Stand Out prompts and 23 Fit In prompts (55 total). All four plus three questions in a daily slate are distinct, and each prompt can appear at most once in any Monday–Sunday UTC week. Returning players who started a daily challenge on v0.1 can resume their original slate (older stored scores are not recalculated). Daily records now save the exact question IDs so future in-progress resumes stay consistent.

Achievements are intentionally **local-only** and are not public competitive claims. Badges include First Spark, On a Roll, Unstoppable, Worldly Mind, High Flyer, Clean Sweep, Deep Cut, and Mind Reader.

## Data transparency and fairness

Current game uses **editorially assigned rarity points** and **fictional sample crowd shares**. They are **not** measured player frequencies, scientific survey results, or real live global votes. The UI labels these clearly in gameplay and results.

The Stand Out prompts intentionally restrict answers to well-defined sets, avoiding open-ended trivia questions the prototype cannot reliably validate. Accepted answers, spelling aliases, and scores live in src/data.js. Minor single-character typos are forgiven only when they uniquely identify one accepted answer. **If open-ended questions are added later, the project needs authoritative validation, alternate-answer review, and appeals before public launch.**

Daily generation is deterministically seeded by a UTC date, so every visitor with the same app version receives the same round sequence. The v0.2 question bank is large enough to ensure **no prompt repeats within a Monday–Sunday UTC week**, using a seeded, deterministic shuffle per week. Prompts may still return in later weeks. Production requires a much larger question calendar, versioned locked daily sets, and reliable editorial review.

### Limitations to address before a real launch

- **Security:** localStorage cannot prevent deliberate replay or tampering. Official scores and one-attempt rules require server-side storage and verification.
- **Live leaderboards:** The **Daily**, **Lifetime Average**, and **Lifetime Total** views currently display genuine local stats only. Real worldwide/friends leaderboards need authenticated player profiles and a backend. Future public average rankings should require **10 completed official daily games**.
- **Monetization:** A **$4.99 one-time lifetime unlimited unlock** is planned. The site does not collect payments or pretend it does. Practice is temporarily free for testing. Implement payments through trusted checkout with server-verified lifetime entitlements.
- **Crowd data:** Replace fictional example shares with defensible scoring data, e.g. opt-in pilot survey results or a versioned prior-day response baseline. Never change points mid-challenge.
- **Content:** Expand and audit question bank, with server-controlled daily publishing, aliases, and source verification.
- **Accounts:** Until synced accounts exist, clearing browser data or switching devices loses stats.
- **Anti-cheat:** A client-only app cannot securely control score submission, question inspection, or retries.

## Structure

    index.html                Static app shell and metadata
    styles.css                Responsive game design and animations
    favicon.svg               Original OUTLIER icon
    src/data.js               Curated question pools and prototype crowd boards
    src/game.js               Pure deterministic daily/weekly rules, scoring, utilities
    src/progression.js        Activity, streaks and official-day badges
    src/online-config.js      Public (blank by default) backend configuration
    src/online.js             Optional account, online gameplay and global board UI
    src/social.js             Friend challenge links and personal category insights
    supabase/migrations/      Secured Postgres tables, SQL scoring and question seed
    supabase/functions/       Verified user API, Stripe checkout and webhook
    docs/ONLINE_SETUP.md      External hosting/payment setup and security notes
    src/app.js                Screens, local storage, timer, interactions, sounds
    test/game.test.js         Pure logic unit tests
    .github/workflows/ci.yml  GitHub Actions syntax and test checks

## Run tests

    npm test
    npm run check

The app has no run-time JavaScript dependencies. CI checks JavaScript and Deno syntax, question/scoring logic, PostgreSQL security and answer processing, plus a headless Chromium desktop/mobile smoke test of the real game flow.

## Roadmap

1. **Prototype v0.1:** daily 4+3 gameplay, practice, score reveals, locally stored records, share card.
2. **Prototype v0.2 (current):** 7-day no-repeat question rotation, bigger pools, achievements, streaks, weekly calendar, enhanced timers/results, keyboard controls, daily-slate persistence.
3. **Closed beta:** real question quality testing, crowd baseline experiments, larger content bank, usability feedback, browser smoke tests.
4. **Accounts + leaderboard service:** backend code implemented; account provisioning, secret setup, hosted deployment and live verification outstanding. server-enforced attempts, profiles, worldwide Daily / Lifetime Average / Lifetime Total rankings, friend groups.
5. **One-time premium:** checkout/webhook implementation present; not active until an owner-configured Stripe account is connected. secure $4.99 unlimited unlock, durable entitlements, pricing and operating cost review.
6. **Hosted v0.3 (source implemented):** verified ranked attempts, Deno Edge API, email login, lifetime payment webhooks; needs third-party deployment and end-to-end validation.
7. **Public launch:** moderation/reporting, accessibility audit, anti-cheat, privacy policy, operations monitoring, content pipeline.

## Philosophy

**Stand Out:** Be the exception.

**Fit In:** Predict the consensus.

The seven-question daily game stays free and competitively fair. Paid unlimited play must **never** boost official daily scores or leaderboards.

---

OUTLIER is a working game name; check branding and trademarks before public commercial launch.
