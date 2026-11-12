# OUTLIER — Outthink the crowd

**A playable, mobile-friendly daily general-knowledge game.** Seven questions, two mindsets: find a rare correct answer in **Stand Out**, then predict the most popular answer in **Fit In**.

> **Prototype v0.6 (arcade and progression update; community backend optional).** This is a static front-end prototype, not yet a production competitive service. No payments, accounts, or worldwide leaderboards are active.

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

## Expanded answer pools — v0.4

The daily Stand Out game now uses **39 broad question types**, each with
**36–249 validated correct answers**, representing **3,796 accepted answer slots**
across the question variations. Some answers appear in multiple questions.

Every official day draws **two geography prompts, one science prompt, and
one rotating general-knowledge prompt**, while the three Fit In rounds
continue as before. The expanded bank includes 249 countries/territories,
184 languages, 118 elements, 50 U.S. states, 50 state capitals, and 63
national parks. **No prompt repeats within the same UTC week.**

Answers such as Ivory Coast / Côte d'Ivoire and Aluminium / Aluminum both
work. Following your answer reveal, you can **search all accepted answers**
to discover unexpected choices and compare their points. There is also
a **Request Answer Review** link if a valid response appears to be missing.

The rarity points are still **curated approximations, not measurements of
how often other players answer something**. See
[Answer Atlas documentation](docs/ANSWER_ATLAS.md) for data sources,
accepted-name rules, scoring transparency, and known limitations.

## Knowledge Arcade v0.5 — movies, music, animals, sports and more

**This release adds 66 new large-pool Stand Out prompts and 30 new Fit In
questions.** The game now holds **137 Stand Out prompts** (105 broad + 32
historical) and **53 Fit In prompts**. The broad question variations
contain **23,617 approved answer slots** between them; many entries can
be accepted across multiple questions, so this is not a claim of 23,617
unique entities.

The major new topic collections cover films, television, performers,
music genres, historical pro sports teams, NBA MVPs, common animals,
bird species, dog breeds, fruits, vegetables, Pokémon, board games,
scientists, and famous people.

- New **category-based practice arcade** with 13 options including
  Surprise Mix, Geography, Movies, Television, Music, Sports, Animals,
  Gaming, History, and more.
- Daily games continue **4 Stand Out + 3 Fit In**, but their four rare
  rounds now mix topics from different fields; a single question can
  accept up to **998 canonical answers**.
- New daily topic rotation begins **November 13, 2026 (UTC)**, to avoid
  changing the already-published November 12 question set.
- Answer Explorer continues to reveal valid alternatives after a round.
- Everything in local practice remains **unranked**. A $4.99 lifetime
  unlock and real server rankings require external service activation.

**These are curated, finite reference collections, not universal entity
recognition or real-world crowd percentages.** Read the
[full content notes](docs/CONTENT_ATLAS.md) for sources,
historical-data boundaries, scoring caveats, and QA.

## OUTLIER v0.6 — Replay, friendships and real progression

The free game now includes three unranked practice formats. **Classic** is the
familiar 7-question 45-second challenge (7,000 max). **Quick Hit** is three
questions at 35 seconds each (3,000 max). **Rare Rush** is ten rare-answer
questions at 30 seconds each (10,000 max), with a selected topic and a broader
mix if that topic has fewer than ten distinct prompts. Each practice category
and format keeps its own best score **locally only**.

New personal motivation includes a **weekly mission**, a **28-day daily-score
chart**, a countdown to the 00:00 UTC daily reset, the next play milestone
and comparisons with previous official daily results. Official dailies
remain seven questions with the original 7,000-point maximum, and
practice never changes official daily/lifetime statistics.

The optional hosted code also now includes verified **friend leagues**,
a weekly worldwide board, account-score history, a controlled answer
review inbox, and historical player-response distributions after at least
30 previous-day responses. These are **not live** until the owner configures
and deploys Supabase; the historical frequencies do not change today's
editorially scored points.

See [Competitive Update](docs/COMPETITIVE_UPDATE.md) for features,
database requirements, security and fair-scoring limitations.

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

v0.5 includes 105 broad prompts (39 original plus 66 new), 32 legacy Stand Out prompts, and 53 Fit In prompts. Mixed-category weekly slates are deterministic, with no repeated prompt during a UTC Monday–Sunday week. Older saved daily slates and scores remain intact.

Achievements are intentionally **local-only** and are not public competitive claims. Badges include First Spark, On a Roll, Unstoppable, Worldly Mind, High Flyer, Clean Sweep, Deep Cut, and Mind Reader.

## Data transparency and fairness

Current game uses **editorially assigned rarity points** and **fictional sample crowd shares**. They are **not** measured player frequencies, scientific survey results, or real live global votes. The UI labels these clearly in gameplay and results.

The Stand Out prompts intentionally restrict answers to well-defined sets, avoiding open-ended trivia questions the prototype cannot reliably validate. Legacy answer aliases and scores live in src/data.js, while expanded answer pools live in src/atlas-questions.js. Minor single-character typos are forgiven only when they uniquely identify one accepted answer. **If open-ended questions are added later, the project needs authoritative validation, alternate-answer review, and appeals before public launch.**

Daily generation is deterministically seeded by a UTC date, so every visitor with the same app version receives the same round sequence. The current question bank is large enough to ensure **no prompt repeats within a Monday–Sunday UTC week**, using a seeded, deterministic shuffle per week. Prompts may still return in later weeks. Production requires a much larger question calendar, versioned locked daily sets, and reliable editorial review.

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
    src/data.js               Legacy rare prompts and prototype crowd boards
    src/atlas-data.js         Source reference facts for the larger answer atlas
    src/atlas-questions.js    Country, science and geography atlas prompts
    src/media-facts.js        Films, television, music, people and games
    src/nature-facts.js       Animals, birds, dogs, produce and Pokémon
    src/sports-facts.js       Historical league snapshot and award winners
    src/hiphop-facts.js       XXL Freshman historic artist reference
    src/content-packs.js      66 additional curated answer-rich questions
    src/fit-expansion.js      30 additional example Fit In crowd boards
    src/journey.js            Weekly missions, recent scores, personal bests
    test/arcade.test.js       Three arcade format scoring and topic tests
    test/journey.test.js      Daily reset and personal progress tests
    test/competition-smoke.sql Verified leagues, reviews and response sample tests
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
2. **Prototype v0.2:** 7-day no-repeat question rotation, bigger pools, achievements, streaks, weekly calendar, enhanced timers/results, keyboard controls, daily-slate persistence.
3. **Closed beta:** real question quality testing, crowd baseline experiments, larger content bank, usability feedback, browser smoke tests.
4. **Accounts + leaderboard service:** backend code implemented; account provisioning, secret setup, hosted deployment and live verification outstanding. server-enforced attempts, profiles, worldwide Daily / Lifetime Average / Lifetime Total rankings, friend groups.
5. **One-time premium:** checkout/webhook implementation present; not active until an owner-configured Stripe account is connected. secure $4.99 unlimited unlock, durable entitlements, pricing and operating cost review.
6. **Hosted v0.3 (source implemented):** verified ranked attempts, Deno Edge API, email login, lifetime payment webhooks; needs third-party deployment and end-to-end validation.
7. **Expanded v0.4:** large verified answer pools, per-category question rotation, an answer explorer and a missing-answer review workflow.
8. **Knowledge Arcade v0.5:** 66 new topical Stand Out questions, 30 more Fit In boards, and 13 selectable practice categories.
9. **Arcade & Competition v0.6 (current):** three replay formats, weekly journey, optional friend leagues and server-reviewed answers.
10. **Public launch:** moderation/reporting, accessibility audit, anti-cheat, privacy policy, operations monitoring, content pipeline.

## Philosophy

**Stand Out:** Be the exception.

**Fit In:** Predict the consensus.

The seven-question daily game stays free and competitively fair. Paid unlimited play must **never** boost official daily scores or leaderboards.

---

OUTLIER is a working game name; check branding and trademarks before public commercial launch.
