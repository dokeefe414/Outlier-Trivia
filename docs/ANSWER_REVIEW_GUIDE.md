# OUTLIER answer-review playbook

**Why this exists:** Great rare-answer trivia requires distinguishing an
actual missing answer from a typo, outdated historical claim, or an entity
outside the prompt's explicitly stated finite reference.

## Player flow

During a Stand Out round, invalid guesses are not accepted, the score
and question index stay unchanged, and the original timer continues.
Players may try another guess. In hosted mode they may submit an
explanation and a reliable reference without giving up the current round.
Guest players can suggest a missing answer through a public GitHub Issue
after time expires or they skip; no automatic upload occurs.

## Owner workflow

1. Connect Supabase, configure a 32+ character \`OUTLIER_ADMIN_TOKEN\`
   through Supabase Edge Function secrets and open \`admin.html\`.
   The token is held only in memory. Use a trusted device and sign out
   by closing the tab.
2. Filter **Pending** reports. Inspect the question's complete eligibility
   wording and the suggested answer.
3. Verify a primary or authoritative public reference, ideally an
   official archive, recognized database or publisher. For a historical
   roster question, check the stated year, not today's roster.
4. Determine whether the answer is truly eligible and whether an alias
   already maps to another approved entity. Do not accept cross-category
   nicknames or a term that ambiguously identifies several candidates.
5. Add a written decision: Approve, Reject, or Needs more info.
   This action is audited. **It does not change any ranked answer set
   or scores.**
6. For an approved missing answer, prepare a new, reviewed versioned
   question ID in the **private** bank for a future week. Never edit a
   question that is already in \`private.official_daily_slates\`.
7. Update the public guest prototype's approved alias overlays only if
   appropriate, update the corresponding SQL migration, run
   \`npm run audit:content\`, and add a regression test for the answer.
8. Review the change after a week of real use and watch for additional
   mistaken rejections. Keep the editorial source/decision date.

## Sample decisions

**Approved (with evidence):** "Steph Curry" corresponds unambiguously
to Stephen Curry in an NBA MVP-list question, using approved nickname
documentation. Grant the same fixed points as the canonical entry.

**Needs more information:** A new music artist name isn't present in
the particular archived source list; the reporter must show the
artist belongs to the reference set and the category is eligible.

**Rejected:** "Pluto" in "Name one of the eight recognized planets"
is not a qualifying current planet. Alternatively, "Giants" in a
cross-league question could mean more than one team and cannot be
assigned arbitrarily.

## Security and privacy

- \`public.outlier_admin_review_queue\` and
  \`public.outlier_admin_review_decide\` have **service-role-only** grants.
  The Edge Function checks the private admin token.
- No admin credentials are embedded in the static GitHub Pages site.
  Browser form submissions use the configured Supabase endpoint over
  HTTPS; they are never cached or placed in URLs.
- The owner dashboard renders player text as DOM text, not executable
  HTML. Review notes are limited in length.
- Every manual decision creates an immutable audit event.
- The public guest GitHub issue system is distinct from private
  account-backed review tickets.
- Do not upload private invitations, email addresses, credit card
  details, or copyrighted images with answer-review submissions.

**No automatic retroactive rescore.** Changing an already-finished daily
after seeing the leaderboard would be unfair. Document the error and
publish a corrected version for future days.

## v1.3 owner-side review CLI

Run `npm run review:answer -- pack-people-celeb-nz Zendaya`.
The tool inspects the **public prototype** finite approved list and prints
`already_accepted`, `ambiguous`, `needs_evidence`, or
`unknown_question`. This is triage, not factual verification: a celebrity
being famous does **not** establish that they occur in the archived
source list named by a specific prompt.

For [reported Zendaya issue #1](https://github.com/dokeefe414/Outlier-Trivia/issues/1),
inspect the precise dated celebrity reference, canonical label, relevant
source license and approved constraints. If absent, explain that result
transparently or propose a *new explicitly defined* future question set.
Never silently alter published ranked question answers or mark an unverified
report accepted. Preserve the answer-review ticket until a documented decision.
