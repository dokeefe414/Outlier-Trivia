# OUTLIER v1.7 — Game Night, Knowledge Mastery & Private Rooms

**Release scope:** Four coordinated upgrades. Guest features run on static GitHub Pages. Online private rooms are deployable infrastructure, **not live** on the public site until the owner provisions Supabase and a separate vetted private party bank.

## 1. Evidence-first answer review

The Stand Out feedback page now has **Review with a Source**. A submission draft requests a canonical answer, why it qualifies under the exact dated prompt, and an HTTPS reference. It opens a prefilled GitHub issue. This is a manual editorial workflow; typing a plausible answer never auto-approves it.

- The browser stores only the link-opening attempt and the proposed answer/source in a bounded local review tracker (up to 40 items).
- Review state is specifically **issue link opened / unconfirmed** until the player attaches an actual `https://github.com/dokeefe414/Outlier-Trivia/issues/<number>` URL. Even after attaching a link, an issue is **not considered approved**.
- Reviewers still inspect the versioned reference and score tier, and archive accepted changes under new IDs where already-sealed official scores are involved. History is never recalculated by players.
- Existing open issues (including celebrity, music, sports and movie candidates) need source verification; no unverified submissions were merged into the answer bank.
- A rejected rare guess can be reviewed after skipping/finishing the round. The review is deliberately not presented as a shortcut to score points mid-round.

## 2. Pass & Play Game Night 2.0

Pass & Play now supports:
- **2–8 named players**, 1–7 games and selected Stand Out topic groups (unchanged).
- **Custom timers:** 20, 30, 45, 60 or 90 seconds/question. Each player sees the same seven prompts for their game.
- **Optional final-round wager:** before question seven is displayed, the player privately chooses **0, 100, 250 or 500 points**. A valid final answer adds that stake to the normal answer points. A missed/skipped final answer loses the stake. Both risk and answer are sealed until the reveal; other players cannot see either during their turns. When disabled, scoring stays unchanged.
- **Portrait badges:** safe initials-based, color-coded identity avatars for the setup, handoffs, reveals, scoreboards and series results; no external face images or photo uploads.
- **Series pulse:** between completed games, the lobby shows a compact verified-by-this-device series table, with previous game wins and points. Current game's points stay sealed until all players finish and all seven reveals are shown.
- **Theatrical commentary:** round-by-round top-pick celebrations and a final cliffhanger that doesn't leak the champion before the scoreboard.
- **Champion rules:** most game wins, then total points. Ties are real co-champions. Wagered game totals can be negative or exceed the normal 7,000 maximum; these are *unranked party totals* only.

Risk constraints: there is no real-money gambling or payout, no official leaderboard promotion, no post-start settings change, no fake opponent, and each match stays in this browser session.

## 3. Knowledge Mastery and trophy cabinet

New `src/mastery.js` computes subject XP, five mastery levels, six collectible trophies, rare-answer count and historical best entirely from **completed official seven-answer guest daily records**:

- Subject levels: Rookie, Curious, Specialist, Expert, Sage.
- Subject XP for accepted rare answers, accepted Fit In predictions, and a nominal learning-progress amount for invalid picks. No tier unlock changes scoring.
- Six trophies: First Find, The Deep File (five rare picks worth 850+), Archive Legend (25 deep cuts), Polymath (ten accepted category names), Four for Four (all four Stand Out picks in one completed daily), and The 5K Club.
- All categories and scores are calculated from the user's own local records. Nothing pretends to be cross-device or worldwide data.
- Unranked practice, the Big List, private rooms and parties do not grant official mastery. No premium purchases or paid boosts affect XP.

The profile and completed daily result show the mastery card, subject progress and trophies.

## 4. Real authenticated private rooms — optional server deployment

The new `supabase/migrations/20261112001800_v17_private_party_rooms.sql` contains isolated private-room storage and service-role-only RPCs. The authenticated Edge Function exposes `party-create`, `party-join`, `party-start`, `party-state`, and `party-answer`.

**Server-verified game flow:**
1. A signed-in host creates an invite-code room. A player receives a spoiler-free `?online=1&room=<code>` link. Joining requires an explicit click; an invite never autojoins.
2. Two to four distinct signed-in accounts join before the 30-minute lobby expiration. Only the owner can start.
3. Server selects four rare and three Fit In prompts from **private.outlier_party_question_bank**, an independently curated *exhibition-only* dataset, NOT from the official private ranked bank. A five-second countdown starts. Each 45-second question window is derived from one shared `starts_at` timestamp.
4. Each player may submit **once per question**; wrong guesses or skips score 0 and are locked, unlike the local daily's retry-unrecognized mechanism. No one receives another player's answer or scores until all seven server windows close, even if their own phone clock differs.
5. After 315 seconds of shared question time, the API reveals canonical accepted picks, earned points and the final scoreboard. Players can advance through seven reveal panels. Ties are retained. **No practice wager here**: online answers use server-scored 0–1,000 per round, max 7,000.
6. Room results never count toward official daily attempts, leaderboards, paid entitlements, league standings, streaks or the local mastery card.

**Security:** The Edge Function verifies each request's Supabase Auth token; database RPC execution is restricted to `service_role` and all tables have RLS enabled with no direct browser grants. Room state checks membership; join/start/submit checks room status, authorization and the server's time. Only the room host can start; requests are rate-limited. Anonymous browser clients cannot query any room table or answer key. Membership is capped at four, and invite codes are random 12-character hex values.

### Why the dedicated question bank is mandatory

Even an unused private ranked question might appear in a future official daily challenge. Using that bank for online exhibition matches would leak future answers and undermine verified rankings. This release **creates an EMPTY independent room bank**, and the game refuses to start until it has at least four validated rare prompts and three valid Fit In prompts. No public migration contains production answers. CI uses a clearly labeled disposable fixture only.

### Owner setup — required before remote play

1. Create a Supabase project, configure appropriate Auth email redirect URLs for the public site, run existing chronological migrations through `20261112001800_v17_private_party_rooms.sql`.
2. Independently author, source-check and populate `private.ranked_question_bank` for legitimate official games (see `docs/PRIVATE_RANKED_CONTENT.md`) **and separately** populate `private.outlier_party_question_bank` with at least four qualifying Stand Out questions and three six-choice Fit In prompts. They must have **different identities and eligibility sets** from every ranked daily prompt; never copy official answer keys for production.
3. Deploy the outlier Edge Function with the project's private service-role secret in **Supabase secrets only**; use the existing `SITE_URL` / origin allowlist. Only `SUPABASE_URL` and the public anonymous/publishable key belong in `src/online-config.js`. Never commit a service-role key, signing key, Stripe secret, or user's email.
4. On two or more real accounts/devices, verify creating, joining, leave/reopen, host-only start, countdown skew, one-answer locks, protected final reveal, timeout, reconnect, and all 315 seconds. Confirm nonmembers get 403 and attempted key leaks fail. Do not enable production billing merely because rooms work.
5. Run `npm run check`, `npm run audit:content` and `npm run test:browser`; database CI applies the separate-room migration, asserts the room bank is empty before disposable fixtures, tests exact source isolation and role restrictions, and exercises the room state machine with a simulated clock.

**Important deployment limitation:** OUTLIER's public static configuration currently has empty Supabase URL and anon key; the integrated private-room UI is therefore unavailable to live public players until those steps are actually completed. No real users, hosted accounts, or backend service were provisioned by this repository release.

## Quality and source-of-truth notes

- Unit tests cover mastery, local review links, party timer/wager settlement, ambiguity-safe aliases, shared room URLs and clock skew.
- Chromium mobile/Desktop tests cover three-player/two-game standard party play; two-player 90-second wager party play; local evidence-review workflow and trophy layouts.
- PostgreSQL tests simulate a room, block non-host and outsider actions, require a separate bank, verify score secrecy before finish, reject duplicate answers, and verify the final server-calculated result.
- The Match Room UI polls state every three seconds and corrects displayed countdowns using the server timestamp. Background browser throttling may delay *display*, but can never lengthen the server deadline or edit points.
- For real-room scale, add rate/latency monitoring and a 20–50 tester beta before describing it as a public release. Accessibility and unreliable mobile networks deserve explicit testing.

## Next beta acceptance checklist

Invite 10–20 friends to play guest daily, Big List, and Pass & Play on phones. Gather sources for valid missing answers, measure confusion over wager timing and category selection, and assess how long each match takes. After backend setup, run a separate two-to-four-user private-room beta. Hold ranked launches until private content is reviewed and all security tests remain green.
