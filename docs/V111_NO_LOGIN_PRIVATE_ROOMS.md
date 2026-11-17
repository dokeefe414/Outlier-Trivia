# OUTLIER v1.11 — No-login private game nights

**Scope:** optional Supabase anonymous Auth for *unranked* private matches, validated nicknames, explicit invitation acceptance, short-lived browser-bound identity, and optional verified account linking. No changes to the official UTC daily question bank, ranked scores, Stripe entitlements, private answer keys, or public table privileges.

## Why this exists

Requiring email confirmation before opening a friends-only room was unnecessary friction. The v1.11 experience is **nickname → CREATE ROOM or JOIN FRIEND → PLAY**. A private invitation URL prefills the invite code but **never signs in, creates a user, or joins a room automatically**. The user chooses JOIN after entering their nickname.

The security boundary is not a self-declared nickname. Supabase **Anonymous Sign-Ins** issues a normal, time-limited, server-validated Auth access token to an anonymous Auth user. The existing Edge Function verifies the token against /auth/v1/user, and all room RPCs use the verified UUID for membership, votes, readiness, answers, server-controlled clocks, and scoring. One authenticated anonymous identity cannot impersonate another player simply by editing their display name or room link.

The browser keeps the Auth refresh session in its normal Supabase storage. Opening the same URL on another device does **not** transfer identity. Signing out, deleting browser data, or losing the session loses access to that temporary identity. The nickname is displayed to room members and may be changed; **it never grants permission**.

## One-time owner setup — required for real guests

The existing Supabase project **must have Anonymous Sign-Ins enabled**. There is no available project-configuration write endpoint in the connected Supabase tools, so the source deployment alone **does not enable this toggle**.

1. Open [OUTLIER Supabase Auth providers](https://supabase.com/dashboard/project/ljmqtdwcwpatyecxtues/auth/providers).
2. Enable **Anonymous Sign-Ins**. Keep the existing email provider enabled for voluntary permanent-account logins. Do not replace or delete existing users.
3. Configure abuse protection. Supabase recommends invisible CAPTCHA or Cloudflare Turnstile for anonymous sign-in; monitor Auth rate limits and usage. If CAPTCHA is enabled, its challenge token must also be wired into signInAnonymously({options:{captchaToken}}) before relying on that configuration. Do not silently enable a challenge without adding its frontend UI.
4. **Optional, only for SAVE MY PROFILE:** Enable manual identity linking in Supabase Auth settings to permit linking an email to an anonymous user. Verify the email-confirmation callback/redirect URL against the existing GitHub Pages site.
5. Confirm the deployed Edge Function is the v1.11 version (its public route rules distinguish is_anonymous from verified accounts). Follow the rollback steps below if the release fails.

Official documentation: [Supabase Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous). Anonymous users carry the authenticated database role; **do not grant general authenticated users direct access to RLS-protected room tables**. Existing tables intentionally deny browser roles and only server-verified RPC routes are allowed.

If the provider is disabled, the guest screen displays a clear configuration message. Existing email sign-in and free local play remain available. Do **not** claim no-login matches are ready on the production site until this toggle and a genuine cross-device match are verified.

## UX behavior and state rules

| View | Behavior |
| --- | --- |
| Public online hub, no session | Main card offers a nickname, optional invite code, and CREATE/JOIN. Email sign-in remains separately available for permanent accounts. |
| Private invitation URL | Code prefills. User must enter nickname and click JOIN. No automatic new Auth user, membership, or acceptance. |
| First CREATE/JOIN | Nickname is validated locally, **and JOIN code validated before** requesting an anonymous Auth session. |
| Temporary guest | Server profile display_name is set using the existing protected profile PATCH. User can edit the nickname; server still uses the underlying Auth UUID. |
| Signed-in registered player | Existing private-room CREATE/JOIN works unchanged. Account history, leagues, and ranked game controls remain behind verified accounts. |
| Gameplay | Host-owned 2–4-player capacity, selectable round timers, category votes, server scoring, seven shared rounds, unanimous championship rematches all work unchanged. |
| Refresh/reconnect | Supabase browser session and existing room-recovery record restore the same room **for the same verified user ID**, never by nickname alone. |
| Guest history | Temporary session retains its own server-side results while that Auth identity exists. Guest UI hides permanent-account career history and paid/ranked features. |
| Optional email link | SAVE MY PROFILE invokes Supabase Auth updateUser({email}); owner must enable manual identity linking, and player must verify the email **without signing out**. No implicit merging into another existing account. |
| End guest session | Explicit confirmation warns that unlinked guest identity and history may become inaccessible. |

### Name handling

- Unicode letters and numbers, spaces, dots, hyphens, underscores; 2–24 characters.
- Whitespace is collapsed and trimmed. Existing server PATCH validates the same character class and length.
- Nickname is cosmetic and not a password, invitation credential, session token, unique key, or means of authorization.
- HTML is escaped when displayed to other players. The browser never trusts the nickname to determine membership.

## Server security

The updated Supabase Edge Function reads the **verified GoTrue user's is_anonymous flag** and permits anonymous Auth users only:

- profile GET/PATCH (their own cosmetic nickname),
- party-create / party-join / party-state / party-start / party-answer,
- party-ready / party-leave / party-rematch,
- party-config / party-target / party-theme.

Anonymous users are denied access to the **ranked daily API, leagues, reviews, Stripe checkout, entitlement restoration, crowd-research consent, lifetime private season/history/mastery API, and other verified-account routes** with account_required_for_this_feature. Public capabilities and leaderboards remain unchanged. This is enforced **before** any private route is dispatched, independent of UI hiding controls. The existing per-identity request budgets apply to anonymous identities, but a user can create more than one browser identity; use Supabase Auth CAPTCHA, rate limits and monitoring to reduce abuse. Do not rely on per-user budgets alone for protection against automated anonymous signups.

No guest sessions are minted by code on initial page load. CORS is not authentication, and no service-role key or hidden answer list is shipped to the browser.

### Retention and cost awareness

Supabase anonymous accounts are real persisted Auth users. They may increase Auth and database usage, and they **are not automatically cleaned up**. Do not blindly delete anonymous Auth users: deleting auth.users may cascade through a guest-owned room and remove records relevant to other participants. Establish a reviewed retention/archive policy before introducing cleanup. Do not claim guest status means "no records are stored"—it means *no email, password, or other PII is requested to participate*.

## QA and acceptance

Run local and CI checks with Node 20+ and Playwright/Chromium:

    npm run check
    npm run audit:exhibition
    npm run test:browser
    npm run preflight:online

The browser smoke suite includes e2e/guest-room-smoke.mjs, which stubs the Supabase SDK and API so it can test an unregistered guest creating a room, a mobile-size guest opening and accepting a valid invite, a disabled-provider error, absence of automatic session creation, presence of an Auth bearer token on private routes, and no mandatory email form.

The unit tests in test/guest-party.test.js cover nickname validation, Unicode, anonymous identity detection, and actionable error messages. CI also executes existing Node, Deno/Edge type, PostgreSQL membership/security, and desktop/mobile game smoke checks. **Mock tests do not prove live Supabase Anonymous Sign-Ins are switched on or that two human devices can finish a match.**

### Real launch acceptance (human step)

1. Owner enables Anonymous Sign-Ins in Auth providers and confirms rate limiting and CAPTCHA strategy.
2. Phone A opens the live site in a fresh browser with no session. Choose nickname, CREATE ROOM. Verify no email request and that the host can choose game settings.
3. Phone B opens the shared invite URL in a *different* browser/profile. Verify no automatic Auth account or join on page open, then choose nickname, JOIN. Verify both player names and distinct room membership.
4. Mark both READY, play seven synchronized rounds, try an invalid answer and repeated submission, and confirm correct final tally with no spoilers before the server deadline.
5. Refresh one device, recover the same room and same nickname, then test a unanimous rematch and 3/4-player capacity.
6. Log out the guest and confirm that the old guest history is not automatically recoverable on another device. Optionally test verified email linking on a **test guest**; do not claim historical data merges with a pre-existing email account.
7. Perform a member/outsider access test: a fresh browser cannot fetch another room by changing a UUID or nickname. Only validated invite acceptance establishes membership.
8. Repeat with a small consenting beta group; collect anonymized feedback and file any crashes/rejected good answers in the existing playtest issue.

The real two-device/human QA gate is tracked in [Issue #17](https://github.com/dokeefe414/Outlier-Trivia/issues/17).

## Deployment order and rollback

This release requires **no new Postgres tables, migrations, or grants**. Guest user profile creation already uses the existing auth.users trigger and private member references remain attached to Supabase Auth IDs.

1. Merge only after Node, Edge, PostgreSQL, and desktop/mobile CI checks pass.
2. Deploy the new supabase/functions/outlier/index.ts with the existing verify_jwt=false setting; every private room route still calls currentUser(req) to verify the token.
3. Deploy the static frontend using the existing GitHub Pages workflow.
4. Enable the provider only when guest API restrictions are deployed. Then perform the two-device acceptance test before announcing general availability.
5. If an unexpected problem occurs, turn **off** Anonymous Sign-Ins for new guests and restore the prior known-good Edge Function and GitHub Pages revision. Already-created anonymous sessions may remain active; existing Auth users and guest-generated records must be treated according to an explicit retention policy.

Do not disable verified email sign-in or modify existing registered accounts to roll back this feature.
