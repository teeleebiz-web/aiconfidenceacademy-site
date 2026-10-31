# AI Confidence Academy learner portal

This repository is the single source of truth for both the public ACA website and
the secure learner portal.

## Production architecture

The official learner entry is https://aiconfidenceacademy.org/learn/.
It is part of this website, not a separate preview project. Introduction records
are loaded from Supabase when the signed-in portal loads. Opening an introduction
requests temporary media and caption URLs from the private `aca-learning-media`
bucket. Updating those database paths does not require rebuilding the portal;
an already-open portal must reload to receive the updated records. Changes to
the player or other presentation code require a tested production build.

Do not infer successful authenticated playback from a saved database row or a
successful website build. Verify the owner experience and learner permissions
before reporting the integration complete.

- Public website: static pages published by GitHub Pages at the repository root.
- Learner portal source: `portal/`.
- Learner portal production build: `learn/`, served at `/learn/`.
- Authentication, enrollment, curriculum, progress, and learner artifacts: the
  existing AI Confidence Academy Supabase project.
- Authoritative curriculum packages: ACA's protected curriculum source and the
  private database. Curriculum text and answer keys are never committed here.
- Confirmation and operational email: Resend through server-side ACA functions.
- Digital books and protected downloads: private Supabase Storage buckets; never
  committed to this public repository.

The browser receives only the Supabase publishable key. Service-role and Resend
credentials remain server-side.

## Enrollment administration

### Independent availability monitoring (October 27, 2026)

The backend exposes `GET` and `HEAD /api/health` on
`https://checkout.aiconfidenceacademy.org`. It returns HTTP 200 and the generic
JSON status `ok` only after a fixed read of the existing operational-monitor
singleton succeeds. A missing record, database error, or four-second deadline
returns HTTP 503 and `unavailable`. Concurrent requests share the probe and its
result is cached internally for 15 seconds; HTTP responses use `no-store`.
The address accepts no database selection, write, mail, or outage-test command.
All owner and learner API authentication remains required.

The intended outside service is StatusCake: one HTTPS monitor for the public
website and one for this backend address, expecting HTTP 200. Confirm the actual
free account's check interval, configure the owner's email contact group, enable
both outage and recovery notifications, and verify delivery with a disposable
test monitor without interrupting production. Keep incident history private and
bookmark the provider dashboard so it remains reachable during an ACA outage.
ACA's own database, cron jobs, and Resend sender are not the notification path.
These probes establish website and database readiness; they do not certify
payments, sign-in, email delivery, or every protected media operation.

**System activity → Independent outage monitoring** records setup rather than
live provider health. Until account setup and alert delivery are verified it
displays **Setup pending**. Only after verification, set the backend production
environment variable `ACA_EXTERNAL_AVAILABILITY` to JSON containing
`dashboard_url` (a private `https://app.statuscake.com/` dashboard URL without
credentials or query strings), distinct numeric `website_monitor_id` and
`backend_monitor_id`, ISO `verified_at`, and actual `interval_seconds` (at least
300). No provider API token is required. The server validates this metadata and
does not expose monitor identifiers. Redeploy after changing the environment
variable; this configuration record does not continuously confirm monitor or
contact settings. Review current results and incident/alert history at the
independent provider. Do not label monitoring active solely from an ACA build.

The owner control center is `/control-center/`, with its own owner sign-in screen.
Its entry checks the session and server-controlled owner authorization without
loading learner enrollment, orientation, or curriculum. Legacy operations links
open this same dedicated entry. Owner email sign-in uses the existing approved
`/learn/` Auth callback and a one-hour, same-browser navigation hint to return
directly to `/control-center/` before the learner application loads. The hint
contains no credentials and never grants access; the server still verifies every
owner request. Password sign-in stays at `/control-center/` throughout.

### Free access invitation delivery updated October 17 2026

In **Access & trials**, choose **Create invitation**, enter the assigned email and
access dates, select **Review invitation**, then **Send invitation**. ACA sends
the secure access email directly to that saved recipient through the existing
operational sender. The confirmation shows the recipient and access period;
Email center separately records submission and provider delivery. Copying and
manually emailing a link is no longer part of the owner workflow.

Previously saved invitations have **Send invitation** in their row. Review the
saved recipient and dates before sending. The server loads those values from
the saved grant rather than accepting a replacement email from the browser.
The trial email has one **Open my trial** button, the course name, and the
access dates. Its private link opens `/learn/?view=trial-access` and automatically
verifies access for the grant's stored recipient. There is no email field,
password choice, or second message. First-time Phase One recipients continue
into the existing founder welcome and Learning ChatGPT orientation. Those
materials and their sequence are unchanged.

The mailed token is random; only its SHA-256 hash is stored in the grant. It
remains usable through the grant's end date and can be reopened without another
email. On each use, the server validates the grant and runs the existing guarded
redemption function, then issues a short-lived Auth verification token. The
browser verifies it, persists the session, removes the invitation fragment, and
opens the assigned phase. The recipient cannot choose another email. Expired,
revoked, converted, or restricted grants cannot issue access. A future start and
all existing learner and paid-access rules remain in force.

The direct-entry email uses `trial-access:<grant-id>:v2`. Selecting Send invitation
for a record that previously received the old email sends its corrected version
once; already-delivered messages retain their old text. Successful repeat sends
of the corrected version are deduplicated. Sending rotates that grant's private
invitation code; older manual code links for the same grant are superseded.
A failed send retains the grant and offers **Retry sending invitation**. After
closing or reloading, use its row action. A conditional email claim prevents
concurrent code rotations. An uncertain provider submission stays visible in
Email center for verification before another try. Sending the email no longer
allocates a new trial enrollment before the recipient opens it; prior allocated
records are preserved. `redeemed` means the trial enrollment was allocated, not
proof of video playback.

Implementation: `academy/enrollment/control-center.mjs`, `academy/server.mjs`,
`portal/src/TrialAccessEntry.tsx`, and the existing control-center interface.
The direct-entry release was followed by the applied
`20261017074310_aca_existing_trial_entry.sql` correction: a second invitation for
the same email and course resumes its existing active trial instead of rejecting
the enrollment as a duplicate. The original grant remains the authority for its
dates and revocation. The additional invitation stays `ready`, without allocating
another enrollment or changing onboarding, completion, or saved work. Its own
expiry and revocation still apply. It cannot restore expired, refunded, paused,
cancelled, suspended, revoked, paid, or installment-restricted access. Existing
paid access continues through its ordinary enrollment invitation.
The newest direct-entry email can be reopened after this database correction;
there is no need to create or send another invitation. Reopen its email button,
because the entry page removes the private token before showing a result.
The focused rollback-only regression is
`academy/enrollment/repeat-trial-acceptance.sql`. An opt-in live component check
is `portal/integration/TrialAccessEntry.live.test.tsx`; it requires a disposable
fixture through `ACA_TRIAL_FIXTURE_FILE` and a private evidence path through
`ACA_TRIAL_EVIDENCE_FILE`, never an actual learner's invitation.
The owner-reported October 17 record was found saved and
unredeemed, with no `trial_access` email for it. The founder subsequently sent a separate invitation; its provider delivery was
confirmed before the direct-entry correction. No corrected invitation was sent
to an existing recipient during implementation; its dispatch remains an explicit
owner action.
Release evidence is recorded in the associated pull request and deployment.

The earlier read-only enrollment backend is
`/api/operations/enrollments` on the existing checkout domain. Every request
validates the Supabase user and the existing server-controlled owner allowlist;
ordinary learner accounts and the construction password alone cannot read it.
The view shows enrollment and effective access status, installment totals and
due dates, invitation/sign-in history, and up to five recent email records per
enrollment. It loads the latest 100 Phase One enrollments. Sandbox Checkout
records are explicitly labeled and never counted as live payment records.
Founder and fixture accounts without a Checkout record are not labeled as debt.
Payment-event processing success is not treated as proof of a successful charge.

Operational email status is synchronized through the signed Resend webhook at
`https://checkout.aiconfidenceacademy.org/api/webhooks/resend`.
`RESEND_WEBHOOK_SECRET` is production-only and remains server-side. October 16
historical delivery reconciliation retains original timestamps and records its
evidence in email metadata. The sandbox Stripe callback uses the existing test
branch's stable Vercel alias, preserving its original signing secret and test
credentials. Its protection bypass stays private. The sandbox branch retains
historical ancestry while its application tree matches the verified main tree
at the October 16 restoration point.

## ACA visual identity

Portal and curriculum surfaces must extend the established ACA website palette:

- Navy: `#102D4F`
- Soft navy: `#1C4267`
- Ink blue: `#18324A`
- Cream/tan: `#F8F3E9`
- Ivory/white: `#FFFDF9`
- Gold: `#B48632`
- Light gold: `#D4B36B`
- Mist blue-gray: `#EEF2F4`

Dark green and rust are not ACA brand colors and must not be introduced into
learner-facing or curriculum production work. Red is reserved only for genuine
error messaging.

## Local validation

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

The development preview opens the learner portal. The production build writes the
same tested source to `learn/` for GitHub Pages.

GitHub Pages serves the committed `learn/` tree. A passing CI or Vercel build
alone does not replace that committed public entry. After a portal source change,
commit the tested generated `learn/index.html` and new referenced assets, then
verify the official `/learn/` loads the expected entry. The existing portal CI
exports these entry files as `tested-portal-entry` for this release step; do not
publish test-environment URLs or keys. Retain existing assets for rollback.

The Phase Two delivery remains the existing frozen bundle. Its maintained
TypeScript controller is `portal/src/phaseTwo/PhaseTwoLearnerHome.tsx` in this
repository's retained `phase-two-curriculum-strengthening` branch (PR 99). Rebuild
that source for a Phase Two controller correction, then update only the approved
bundle/reference and the tested public entry in current main. Do not merge that
historical branch wholesale or change curriculum/publication to test access.

## Release boundary

Do not merge the learner portal into `main` until:

1. the branch checks pass;
2. the sign-in redirect URL is approved in Supabase Auth;
3. a controlled ACA learner account and enrollment are provisioned;
4. Lesson 1.1 is exercised in the browser and its progress is verified in the
   database;
5. Terrence approves the learner-facing preview.

The Phase One database now contains all six journeys and all 36 lessons. Only
approved rows are visible to ordinary learners. A server-controlled reviewer
allowlist in the private database grants the ACA owner access to the complete
working build under additional read-only RLS policies; this review mode does not
save lesson progress or learner artifacts.

## Integrated Phase One owner review

The protected owner-review experience is assembled as one connected course:

- 6 journeys and 36 guided sessions;
- 45–60 minutes of core learning per session, with optional continuation kept
  outside the core estimate;
- teaching, guided practice, reflection, verification, and a completion gate in
  every session;
- previous/next navigation across lesson and journey boundaries;
- a visible session map and consistent transition into the next lesson; and
- read-only owner review with no progress or artifact writes.

Each Journey welcome has two independent protected media positions:

1. a short founder or avatar video featuring Terrence; and
2. a companion audio overview voiced by Knowledge.

Until final recordings are attached, branded production placeholders remain in
those positions. Founder and companion transcripts are stored with the protected
curriculum records, displayed independently, and ready to support captions. The
public repository contains the presentation code and schema history, but not the
protected curriculum scripts or media.

Before enabling owner review in production:

1. apply the owner-review RLS migration;
2. add the owner to the private reviewer allowlist through trusted administration;
3. verify the portal recognizes that server-controlled authorization;
4. verify that an ordinary authenticated learner still sees published material
   only; and
5. verify the complete owner view on desktop and mobile before any curriculum
   status changes.
