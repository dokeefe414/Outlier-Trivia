# OUTLIER — Outthink the crowd

**A playable, mobile-friendly daily general-knowledge game.** Seven questions, two mindsets: find a rare correct answer in **Stand Out**, then predict the most popular answer in **Fit In**.

> **v1.3 competition and discovery — weekly spotlight, Daily Debrief, league cup displays, opt-in crowd research and editorial QA.** The v1.2 editorial design remains intact. The hosted features still require Supabase, private ranked content and real player validation.

> **v1.2 editorial redesign — an original OUTLIER visual identity, new printed-ticket game screens, and no generic glowing-orb dashboard.** The repository now contains production-oriented account, private-content, social league, editorial-review and Stripe test-mode infrastructure. Supabase/Stripe credentials, privately authored ranked answers and real-user validation are still required. No live payments or worldwide leaderboards are active.

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

## v1.3 — Competition & Discovery

Five new release workstreams improve what happens between daily games.

- **Daily Debrief (playable now):** Genuine session-derived standout pick, strongest crowd call, missed rounds, actual accepted answers, and a category score ledger in guest and hosted results. No fictional player comparisons.
- **Weekly Spotlight (playable now):** A free, deterministic 10-question themed rare-answer challenge, identical across each UTC week for everyone running the same game version. A 30-second timer, unranked weekly personal best, and optional score sharing make this replayable without touching official results.
- **Friend League Weekly Cup (hosted source):** Verified weekly points drive provisional head-to-head matchups; previous-week comparisons are retrospective. Pairings are exhibition comparisons, not a locked elimination bracket.
- **Opt-in Crowd Pulse (hosted source):** Authenticated users explicitly permit completed future official responses to contribute anonymously to observed Fit In comparisons. Counts are visible only to people who completed that question, only after 30 prior-day eligible responses. Withdrawal excludes prior contributions immediately. Frozen editorial scoring remains unchanged.
- **Editorial QA (owner tool):** `npm run review:answer -- <question-id> <answer>` checks whether a proposal is already accepted and identifies ambiguous or source-needed cases. Human reference checks are required before versioned edits. Existing approved answers are not broadened blindly.

**Status:** Guest features are in the deployed source when v1.3 is merged and Pages redeploys. The optional Supabase backend, private production question bank, opt-in crowd data, and authentic online users are **not** provisioned by this commit. No Stripe checkout was enabled. See [v1.3 implementation and privacy guide](docs/V13_COMPETITION_DISCOVERY.md).

## v1.2 — OUTLIER Issue 01: Art direction overhaul

OUTLIER has a distinctive visual voice now: **THINK ODD. BE RIGHT.**
A creative direction inspired by independent sports zines and printed trivia
field guides, instead of the generic purple-gradient/glassy-dashboard look.

What changed:
- Original broken-ring **O** logomark and matching custom SVG favicon.
- A typographic **seven-question poster** built with actual HTML/CSS
  (no stock art or generated illustrations).
- Cream print-paper game tickets, hard-stamped scoring, handmarked accents
  and two clearly differentiated question types.
- Three asymmetrical color-blocked rule cards, a scoreboard-like player
  profile, and cohesive typography for practice, missions and leagues.
- Intentional mobile layouts and reduced-motion handling.

The **gameplay rules and approved answer libraries were not altered**.
The one-free-daily limit, retry-until-valid answer handling and all
existing progression continue to work as before. Online verified
competition and Stripe still need your own Supabase/merchant setup.

See [v1.2 art direction and responsive QA](docs/V12_ART_DIRECTION.md).
GitHub Actions uploads **editorial-screenshots** (desktop/mobile views)
for manual design inspection.

## v1.1 — Knowledge Atlas, rare-answer celebrations and friend rivalries

This release puts much more care into the **feel of playing OUTLIER**.

- **High-energy rare reveals:** 850+ and 950+ point rare answers get
  distinct animated moments, with reduced-motion fallbacks and honest
  comparisons against *approved editorial answer scores* (not invented
  player-popularity data).
- **Earned player identities:** Five player titles and five collectible
  profile frames unlock solely from completed official daily games.
  Cosmetics and XP never change official ranks or accepted answers.
- **Four weekly missions:** Collect daily participation, rare-answer
  success, crowd predictions and weekly points; quests reset Monday UTC.
- **Deeper Knowledge Atlas:** See your five highest-valued distinct
  accepted rare answers, category strengths, unique entries, accuracy and
  seven-game trends in your local player profile.
- **Head-to-head friend rivalries (hosted backend):** Within a private
  league, compare server-verified days both friends played the same free
  official daily. View win/loss/tie totals, current streak and spoiler-free
  invitation links. Requires Supabase; not live by default.
- **Better library improvement loop:** After any Stand Out round,
  players can suggest a missing answer with a credible reference, for
  manual review. Existing content audits and accepted lists remain in
  place; no unverified content is automatically accepted.

See [v1.1 Game Experience notes](docs/V11_GAME_EXPERIENCE.md) for
design, accuracy boundaries, tests and deployment requirements.

## v1.0 beta candidate — six core upgrades

This update strengthens the move from a fun prototype to an account-backed
competitive game **without replacing the free daily experience**:

- **Verified competition gate:** Server rejects incomplete private question
  banks, checking accepted aliases, integer scores, reference coverage and
  six-choice Fit In totals before starting any online ranked game.
- **Social league invitations:** Shareable private league links, explicit
  opt-in joining, weekly leaders and previous-week champions, with official
  daily scores only.
- **Better game feel:** Keyboard focus after answer reveals, accessible score
  announcements, responsive social views and reduced-motion support.
- **Privacy-safe beta insights:** Aggregate rejected-guess and affected-game
  counts alongside existing completion and cohort-retention reporting,
  restricted to the owner.
- **One-time purchase controls:** Stripe test/live key separation, explicit
  owner approval before live checkout, and a server-verified restore/check
  purchase button.
- **Release playbook:** A concrete two-week 20–50-person test plan, QA gates,
  moderation requirements and owner deployment steps.

The **v1.0 beta candidate is not an online launch**. The real Supabase
project, private ranked answer bank and Stripe merchant test accounts have
not been connected or activated. The daily guest game remains free and
playable with no registration.

See [v1.0 beta launch playbook](docs/V1_BETA_PLAYBOOK.md).

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
contain **23,619 approved answer slots** between them; many entries can
be accepted across multiple questions, so this is not a claim of 23,619
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

## v0.7 — First impressions, seasons, and secure competition

The free GitHub Pages game now has a **four-step skippable tutorial**,
weekly cosmetic seasons (Rookie / Contender / Ace / Legend), a past-season
archive, four unlockable game color themes, and a guided beta checklist.
Players earn cosmetic unlocks through **completed official daily games only**;
purchases and unlimited practice never improve their rankings.

The optional online code now includes a **separate empty private ranked
question bank** (future official answers are not committed publicly), sealed
daily question slates, immutable keys after publication, verified billing
event handling including refunds/disputes, request budgets, and owner-only
aggregate beta metrics. None of those online or payment services are live
with the current blank public Supabase configuration.

This release prepares for **20–50 opt-in beta testers**, not an automatic
public launch. We still need owner-controlled Supabase/Stripe services,
privately authored ranked questions, live end-to-end testing, moderation
and support before enabling multiplayer or purchases. See
[v0.7 release notes](docs/RELEASE_V07.md) and
[private ranked content guide](docs/PRIVATE_RANKED_CONTENT.md).

## v0.8 — Keep guessing until an approved answer is found

On **Stand Out** rounds, a submitted answer that is **not in the accepted
answer library** now shows a clear inline message and lets the player
keep trying on the **same question**. An unrecognized guess:

- **does not** count as one of the seven official answers,
- **does not** award points or end the round,
- **does not** reveal the answer list or reset the timer,
- **does not** prevent the player from entering another valid answer.

An accepted answer immediately locks in and scores normally. The question
ends with zero points only when its original 45-second timer runs out or
the player deliberately presses **Skip**. Practice formats keep their own
original time limits. The same rule is implemented in the optional hosted
Supabase scoring RPC so invalid answers cannot advance a verified game.
Players can still request an answer review if they believe a rejected
answer should count.

See `test/retry-invalid-smoke.sql` for server tests and the desktop/mobile
browser tests for guest behavior. Note: actual online mode still requires
owner-controlled Supabase deployment and private ranked questions.

## OUTLIER v0.9 — Every legitimate answer deserves a fair chance

The answer engine now recognizes curated nicknames such as **Steph Curry →
Stephen Curry**, alternate film titles and team abbreviations, improved Unicode
spellings, and safe single-character typos. **Ambiguous or invented answers
remain invalid**, and players can continue guessing until their original
timer expires. Two separate Pokémon species (Nidoran♀ and Nidoran♂) are
now correctly distinguishable; the historic NBA MVP name Bob Pettit is fixed.

After a correct Stand Out answer, the reveal can explain whether it matched
exactly, through an approved alias, or through a typo. It also shows the
answer's **score rank within the accepted library**, not a fabricated crowd
rarity percentile. Familiar MVP winners such as Stephen Curry now have
more sensible editorial points; no published ranked results are recalculated.

We've added an **owner-only Review Studio** (`admin.html`) and a
service-protected review queue with an audit trail. It requires your own
Supabase deployment and `OUTLIER_ADMIN_TOKEN`; it is not accessible on
the default unconfigured site. Player reports can be marked for future
editorial changes, but cannot silently rewrite old scores.

Use `npm run audit:content` to validate the 105 broad question sets,
**23,619 broad accepted answer slots**, alias collisions and score ranges.
A new owner-local `scripts/validate-private-bank.mjs` tool verifies
privately prepared ranked content without uploading answer keys to GitHub.

See [v0.9 technical notes](docs/V09_ANSWER_INTELLIGENCE.md),
[answer-review workflow](docs/ANSWER_REVIEW_GUIDE.md) and
[multiplayer beta activation checklist](docs/BETA_READINESS.md).

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
    src/beta.js               Tutorial, weekly cosmetic seasons, beta checklist
    src/answer-intelligence.js Safe normalized answer matching and collision checks
    src/approved-aliases.js   Curated category-specific alternative names
    src/rarity-insights.js    Transparent editorial rarity explanations
    src/player-atlas.js       Titles, frames, weekly quests and Knowledge Atlas
    src/rare-moments.js       Editorial-score-based discovery celebrations
    docs/V11_GAME_EXPERIENCE.md Design and hosted rivalry deployment notes
    docs/V13_COMPETITION_DISCOVERY.md v1.3 setup, limits and privacy model
    admin.html                Owner-only review interface (requires backend)
    scripts/audit-content.mjs Automated public answer-bank auditing
    scripts/validate-private-bank.mjs Offline, owner-local ranked bank validation
    docs/RELEASE_V07.md       Security, monetization and beta launch plan
    docs/PRIVATE_RANKED_CONTENT.md Private answer curation and quality controls
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
9. **Arcade & Competition v0.6:** three replay formats, weekly journey, optional friend leagues and server-reviewed answers.
10. **Public Beta Readiness v0.7:** tutorial, weekly cosmetic seasons, themes, private ranked-content isolation, hardened purchase lifecycle and aggregate retention reporting.
11. **Fair Answer Retries v0.8:** Invalid guesses can be retried until accepted, skipped, or timed out, in guest and hosted play.
12. **Answer Intelligence v0.9:** vetted nicknames and scoring calibration, faster safe matching, better rarity reveals, audited review administration and private-beta validation scripts.
13. **Competitive Beta v1.0 candidate:** strict private-bank launch gate, consent-based friend invites, previous-week champions, owner-only quality analytics and explicit Stripe live-mode controls.
14. **Game Experience v1.1:** animated editorial rarity moments, personal titles and frames, Knowledge Atlas, weekly missions, missing-answer suggestions and member-only rivalry comparisons.
15. **Independent Art Direction v1.2:** bespoke type-led homepage, CSS poster, magazine-like ticket/game/result views, custom mark, editorial mobile design.
16. **Competition & Discovery v1.3 (current source):** Weekly Spotlight, debriefs, verified exhibition matchups, crowd opt-in/pulse and evidence-based answer-review CLI.
17. **Public launch:** moderation/reporting, accessibility audit, anti-cheat, privacy policy, operations monitoring, content pipeline.

## Philosophy

**Stand Out:** Be the exception.

**Fit In:** Predict the consensus.

The seven-question daily game stays free and competitively fair. Paid unlimited play must **never** boost official daily scores or leaderboards.

---

OUTLIER is a working game name; check branding and trademarks before public commercial launch.
