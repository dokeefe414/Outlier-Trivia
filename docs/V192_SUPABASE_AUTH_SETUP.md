# OUTLIER v1.9.2 — Supabase Auth and Protected Online Routes

## Actual configuration performed (November 16, 2026)

The owner-linked **Outlier-Trivia** Supabase project `ljmqtdwcwpatyecxtues` (US East 1) was connected, not a new or duplicate project.

- Applied **all 38** versioned OUTLIER PostgreSQL migrations from `supabase/migrations/` to the empty project in repository order (initially no app schema or historical migrations). Migration history is recorded in Supabase as `outlier_<original_file_stem>` with platform-assigned execution timestamps.
- Deployed `supabase/functions/outlier/index.ts` as **active** `outlier` Edge Function. It serves `/functions/v1/outlier?action=...` and uses the Supabase-managed `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` **only on the Edge server**, never in browser files.
- Configured public `src/online-config.js` with the Supabase project URL and a **publishable browser key** (`sb_publishable_...`). This is an intentionally public project identifier, not a database password. **Never commit a secret API key, service role credential, user access token, owner token, or a Stripe secret**.
- The Edge endpoint's canonical allowed browser origin is `https://dokeefe414.github.io`. The backend uses the Pages URL `https://dokeefe414.github.io/Outlier-Trivia/` when no separate `SITE_URL` secret has been set. Local `http://localhost:8000` and `http://127.0.0.1:8000` are also permitted by the existing local-development policy.
- Strengthened browser account gating to use `supabase.auth.getUser()` instead of trusting only a cached `getSession()` user. Sign-out events clear cached room pointers, account/game state, rankings, friend records, and other protected UI data. The API still independently checks each private request's Auth access token on Supabase `/auth/v1/user`.
- Preserved the existing free guest daily, Big List and local Pass & Play. These **never require signing in**.
- Verified database access permissions through a read-only query: neither `anon` nor `authenticated` can directly SELECT `public.outlier_party_rooms`, and neither role may EXECUTE `outlier_party_state(uuid,uuid)`. The Edge `service_role` can execute the checked function.
- At deployment time, the separate private exhibition room bank contained **zero questions** and `partyReady=false`. This release sets up authentication/protected routes; it **does not claim that online room matches are playable until the separately reviewed room bank is imported**.

## The one required Auth Dashboard step

The Supabase project management integration can deploy schema and functions but does not expose an action for modifying **Authentication URL Configuration**. The owner must finish this part in the Supabase Dashboard (without sharing passwords):

1. Open [Supabase Auth URL Configuration](https://supabase.com/dashboard/project/ljmqtdwcwpatyecxtues/auth/url-configuration).
2. Set **Site URL** to `https://dokeefe414.github.io/Outlier-Trivia/`.
3. Add to **Redirect URLs**:
   - `https://dokeefe414.github.io/Outlier-Trivia/`
   - `https://dokeefe414.github.io/Outlier-Trivia/?online=1`
   - For local development, `http://localhost:8000/` and `http://localhost:8000/?online=1` if needed.
4. In [Auth Providers](https://supabase.com/dashboard/project/ljmqtdwcwpatyecxtues/auth/providers), confirm **Email** sign-in is enabled and email confirmation/template and sending limits are appropriate. The app sends a one-time passwordless email link through `signInWithOtp` and uses PKCE. Never sign in with a real user's email without their consent.
5. Sign in to OUTLIER on the canonical Pages site using a real controlled test email. Confirm the link returns to `?online=1`, restores the session, displays only that signed-in player's private profile, and signing out hides all protected actions. Test a second account in a different browser. This was **not performed using a real email in this automated configuration**.

The login redirect is a **client-side navigation convenience**, not authorization. Authentication and room membership are enforced by Supabase Auth, server-side checks, and restricted SQL RPC privileges.

## Protected route boundaries

The single Edge Function intentionally uses `verify_jwt=false` at the platform gateway because its API multiplexes public `capabilities`, a future **signed Stripe webhook**, and other requests on one URL. **This does not make private routes public**:

- Public: GET `capabilities`, GET `leaderboard`. Webhook POST requires Stripe signature validation and configured secret.
- Owner administration: `admin-metrics`, `admin-review-queue`, `admin-review-decision` require the **separate owner secret token**; do not confuse this with a normal user login.
- All other API actions (profile, account-scoped records, official games, league membership, private room create/join/read/ready/start/answer/rematch, user match history/season/rivalry, purchase checks) call `currentUser(req)` **before** doing any action. It verifies the bearer JWT with `/auth/v1/user`; a service-role key used as a bearer token is refused, and missing/expired session tokens yield HTTP **401**.
- The Edge Function talks to Postgres using the service role; the browser has no direct table grants or access to private answer keys. The existing security-definer functions are narrowly scoped by verified `p_user` and require room memberships/host consent as appropriate. CI applies disposable-user adversarial smoke tests.
- Keep Supabase `service_role` and any owner token out of all static HTML/JS, screenshots and issue reports. CORS limits browser-origin requests but **does not replace JWT and membership authorization**.

## What is not yet activated or verified

The 38 database migrations include an empty `private.outlier_party_question_bank` on purpose. To allow private 2–4 player matches:

1. Run `npm run audit:exhibition` and `npm run prepare:exhibition`.
2. Inspect the separate 18 rare / 10 Fit In exhibition sample under the gitignored `private/generated-exhibition-import.sql` and confirm each source scope and editorial weight.
3. Import the reviewed SQL using the authorized Supabase dashboard or an approved migration/import process. Never add unpublished official ranked daily answers. Then `GET capabilities` should report `partyReady: true`.
4. Run a true two-account, two-device private match and confirm read/submit/member/host protections, clock synchrony, reconnect and final scoreboard. The existing CI fixtures **do not** prove live Auth email deliverability or a real internet multiplayer session.

Separate, server-ranked official daily play likewise remains gated until the future daily private bank is curated/verified. Billing/Stripe remains unconfigured and must not be enabled accidentally.

## Verification and operations

- Node code/contract tests: `npm run check`, `npm run audit:content`, `npm run audit:exhibition`.
- Browser UX: `npm run test:browser` (live account sign-in must still be tested manually).
- Source/deployment preflight: `npm run preflight:online`. This can only examine static configuration, not real hosted Auth or email settings.
- Supabase SQL check for data isolation:

```sql
select has_table_privilege('anon','public.outlier_party_rooms','SELECT') as guest_can_read_rooms,
       has_table_privilege('authenticated','public.outlier_party_rooms','SELECT') as user_can_read_rooms_directly,
       has_function_privilege('anon','public.outlier_party_state(uuid,uuid)','EXECUTE') as guest_can_read_room_rpc,
       has_function_privilege('authenticated','public.outlier_party_state(uuid,uuid)','EXECUTE') as user_can_read_room_rpc,
       has_function_privilege('service_role','public.outlier_party_state(uuid,uuid)','EXECUTE') as server_can_read_room_rpc;
```

Expected `false,false,false,false,true`. Supabase's security advisor may report "RLS enabled, no policy" as **informational** for tables deliberately inaccessible to browser roles; this is a deny-by-default design and should not be "fixed" with a broad `TO authenticated` policy.

Additional Auth docs: [Supabase passwordless email login](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Edge Function authorization headers](https://supabase.com/docs/guides/functions/auth-headers), [Securing the Data API](https://supabase.com/docs/guides/api/securing-your-api).

**State of this release:** Backend schema and Edge function deployed; public client integration committed; browser flows protected; owner Dashboard redirect URLs and real test email still require human action. Real hosted API responses and cross-device sign-in were not independently verified from this environment.
