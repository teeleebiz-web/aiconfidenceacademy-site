# AI Confidence Academy learner portal

## Approved Script Two welcome publication — November 22, 2026

Terrence reviewed the complete 709.489-second film and explicitly approved placing
it in Welcome to the Academy. The only approved media change is his Script Two
founder segment and the shortened original opening card. First speech is at
0.931458 seconds. All 14,105 instructor/closing frames remain in order; retained
audio correlation is 0.998109. The full MP4 decoded successfully and supports
progressive playback. Founder look/voice match the November homepage/Our Story.

The exact approved file is 81,887,736 bytes, SHA-256
`350e6cb65f13cdd5c6c1938a6d96af063a74c0c9726b9fe86dceff7d50fafff6`.
The existing private target remains
`aca-learning-media/academy-welcome/ACA_Welcome_to_the_Academy_Film_Web_v01.mp4`.
The existing publication workflow now accepts this exact reviewed file through a
time-limited, non-overwriting private staging upload. It verifies a private copy
of the previous live film, verifies the staged bytes, rechecks the live fingerprint,
replaces the existing object without re-encoding, and verifies the downloaded bytes.
No media is committed to the public repository. The publication ledger key is
`academy-welcome-script-two-20261122`; only `verified` proves installation.

Seven focused publication safety/recovery tests pass locally. Publication and
live browser playback evidence will be added below after actual execution. Edge
page interactions currently time out; do not claim a one-second network start or
signed-in playback without observing it. Monitoring remains paused; no enrollment,
payment, curriculum, instructor, DNS or hosting configuration change is included.

## Owner curriculum entry restored — November 22, 2026

Terrence explicitly requested permanent curriculum access from the Control Center,
starting with the same Welcome to the Academy and ChatGPT orientation that a
Phase One learner sees, continuing through lessons and workbooks, with Phase Two
also available. This navigation work does not depend on registrar access or
authorize the separately pending hosting switch or monitoring reactivation.

Based on main `913512b559aa84b46a11c1a5c7f195c599f167ea`. The live Control
Center showed lesson-management/inspection controls but lacked a full curriculum
entry. The explicit owner welcome address reproduced a curriculum dashboard
instead of the Welcome sequence. New regression cases reproduced both gaps.

The Control Center now has a persistent **Curriculum review** navigation item
and a prominent **Review curriculum** shortcut. Its review section links to:

- `/learn/?review=phase-one&view=welcome` — the existing approved Academy welcome
  film, the existing Getting Started with ChatGPT component, then Lesson 1.1;
- `/learn/?review=phase-one&view=curriculum` — all Phase One journeys/lessons;
- `/learn/?review=phase-one&view=workbooks` — Phase One workbook access;
- `/learn/?review=phase-two&lesson=1.1` — the first Phase Two lesson; and
- `/learn/?review=phase-two&view=curriculum` — all Phase Two lessons/workbooks.

Both phase review screens provide persistent links back to the Control Center,
the Welcome sequence, and the curriculum/workbooks. The welcome uses the actual
learner components and existing signed media path; no substitute video, duplicate
curriculum, trial, enrollment, schedule, publication or database migration is
created. Existing owner authorization and RLS remain required. Owner continuation
now stays in local review state even if the owner also has an unfinished learner
enrollment; it cannot mark onboarding complete or start a learner clock. Ordinary
learner onboarding still uses its existing completion and access checks.

Local evidence: 75 targeted routing, owner access, Control Center, Phase Two and
orientation tests passed; 17 onboarding tests passed after aligning the prior
owner-completion expectation with read-only review. Type checking and the default
production build passed. Compiled Pages entries accompany the source. Required
hosted checks and signed-in live navigation/playback verification are recorded
with the associated PR and follow-up receipt before completion is claimed.

### Publication receipt — November 22, 2026

PR #130 is merged at `8377d0812418e3d5fed860a3090880a460512c19`.
The exact feature head `bb22144cc9f52ccf920eee4783445f69be2fcd23`
passed ACA learner portal checks (run 44999101772, including application tests,
both builds, database acceptance and code isolation) and Phase Two Lesson 1.1
acceptance (run 44999101790). The merge revision also passed portal checks
(run 44999418068), and Pages publication succeeded (run 44999417594).

Direct HTTP retrieval from the live Academy domain confirmed byte-for-byte
matches with this build for the Control Center and learner HTML entries, the
Control Center, App and Phase Two JavaScript bundles, and both changed CSS
bundles. This verifies publication of the intended feature.

**Remaining verification:** the connected Edge session timed out on the
post-publication Control Center reload and again while requesting connection
troubleshooting guidance. Therefore a signed-in post-publication Welcome →
ChatGPT orientation → Lesson 1.1 walkthrough, workbook checks, and a screenshot
are not yet verified. Do not report these as completed or repeat unrelated
diagnostics. Resume those exact UI checks when Edge is available. No trial,
invitation, learner progress update, monitoring reactivation, or GoDaddy change
was made for this feature.

## Prelaunch monitoring pause — November 22, 2026

**Controlling owner instruction:** the Academy is still in build mode. Pause
continuous operational diagnostics and automatic repair processing until the
owner approves launch activation. Do not turn these back on merely because
development resumes. Preserve backups and checks that validate actual changes.
This instruction supersedes older instructions below to keep these routines
running continuously.

### Applied and verified

- Removed the Cloudflare `aca-incident-timer` cron `*/15 * * * *`.
  API readback shows only the existing nightly backup cron `17 18 * * *`
  (02:17 Asia/Manila; 01:17 Asia/Bangkok). Backup settings and credentials were
  not changed.
- GitHub confirms “This workflow was disabled manually” for
  `incident-diagnostics.yml`, `support-code-worker.yml`, and
  `support-release.yml`. This holds both recurring diagnostics and the
  associated automatic coding/release chain. Workflow source is retained.
- Latest observed diagnostics run `44995178577` and coding run `44995329012`
  had already completed successfully before the pause; automatic repair release
  had zero runs. No new diagnostic or coding run was requested for this change.
- Application code, nightly backup workflow, and code-change acceptance checks
  are unchanged. This is an operational pause, not evidence of a new defect.

### Required before launch activation

1. Obtain the owner's explicit launch activation approval and verify the chosen
   monitoring arrangement and actual expected cost. The earlier $69.12 figure
   was a projected private-repository runner cost, not a verified bill.
2. Review any pending support cases and stale repair branches before restoring
   automatic handling. Re-enable the coding and release workflows only when
   their bounded repair/release controls are ready.
3. Re-enable the diagnostic workflow and choose one intended timer arrangement.
   Native GitHub scheduling remains defined in the workflow; Cloudflare's
   quarter-hour trigger was the external fallback. Do not blindly activate both.
4. If restoring the external timer, restore `*/15 * * * *` alongside the
   existing backup cron and verify `ACA_TIMER_ENABLED` deliberately. Do not
   change `ACA_BACKUP_TIMER_ENABLED` or overwrite the backup schedule.
5. Verify one controlled collection/repair-handling cycle and owner reporting,
   then record the exact activation evidence here.

**Saved configuration:** `operations/incident-timer.wrangler.json` now matches
the deployed backup-only cron list. Future deployment must preserve the live
backup activation override; both checked-in activation defaults remain false.
Keep the three GitHub workflows disabled until explicit launch approval.
Do not treat this pause as cancellation of subscriptions or proof that all
platform charges have stopped.

## Release preparation while registrar access is pending — November 22, 2026

Prepared from main `fcd3526c1acfcfc813b8a4ef83971f0884421ac4`. Application
behavior remains the already verified PR #128 revision. The only operational
configuration change removes the quarter-hour Cloudflare trigger from source,
matching the live pause. The runtime fixtures explicitly exercise the retained
incident handler without relying on its position in the active schedule list.
They continue to prove backup dispatch, disabled no-network behavior, incident
dispatch when explicitly activated, and redirect rejection. Local validation:
17 timer/backup tests passed; the three workerd tests were rerun after preserving
disabled incident-event coverage and passed. No real token or provider dispatch
was used. Hosted verification is recorded in the associated PR before merge.

### Prepared switch settings — not activated

The target remains the existing paid Vercel project
`prj_bMtMImZai47HLEM7DqlhwOZI81NN` (`aiconfidenceacademy-site-mkvf`), which
already owns `checkout.aiconfidenceacademy.org`. Do not create another project
or subscription. Names/types/scopes-only environment inspection confirms the
two protected-delivery flags below are preview-only and absent in production.
No secret values were decrypted or copied.

| Change at the authorized switch | Prepared value / boundary |
| --- | --- |
| Existing Vercel production variables | Set `ACA_PRIVATE_PHASE_TWO_MEDIA=true` and `ACA_PUBLIC_SITE=true` together; preserve all other production settings. Build the exact reviewed source and retain a protected rollback deployment. |
| Domain attachments | Attach `aiconfidenceacademy.org` and `www.aiconfidenceacademy.org` to that project; use the apex as canonical and redirect www to it. Verify ownership and TLS before completing the switch. |
| GoDaddy apex A records | Vercel's project-scoped API currently recommends `216.150.1.1` and `216.150.16.1` (rank 1), replacing the four existing GitHub Pages A records. Re-read the project's recommendation at execution time. |
| GoDaddy www CNAME | Current target is `teeleebiz-web.github.io.`; project-scoped recommendation is `672b60f83fd7e9a9.vercel-dns-017.com.`. Re-read at execution time. |
| Records to preserve | Keep GoDaddy nameservers, checkout, mail/MX, SPF, DKIM, DMARC and unrelated verification records. Export/review the actual zone first; a public DNS query is not a full zone inventory. |
| Auth return address | Preserve the existing production `https://aiconfidenceacademy.org/learn/` Site URL. No new wildcard or preview callback is needed merely because its hosting changes. |
| Release mode | Set the GitHub repository variable `ACA_PUBLIC_SITE=true` for future supported releases, while leaving all three paused operational workflows disabled. |
| Old public copies | After protected delivery is confirmed, retire Pages and coordinate repository privacy so old Pages/raw/blob/download routes no longer bypass authorization. Check public-copy denial before declaring protection complete. |

Vercel reports the present apex/www as not configured for Vercel because they
still intentionally point to Pages. This is the known cutover state, not a new
outage. The GoDaddy sign-in code and explicit activation authority remain needed.
No DNS, production flags, repository visibility, plan or subscription was changed.

### Remaining acceptance after the switch

Reuse the existing payment, enrollment, email, timer, isolation and full recovery
receipts. Exercise the ordinary learner sign-in, entitled media/workbook and
saved-work path on the released configuration only after Terrence authorizes the
trial start. Verify anonymous and unauthorized access denial, including the old
public routes. Do not start an enrollment, payment, invitation or artificial
production failure just to fill this checklist. Automatic monitoring/repair
activation is a separate launch decision and remains paused during preparation.

## Current launch closure record — November 22, 2026

This summary supersedes older pending-status statements below only where explicit
evidence is supplied. Preserve the historical record and completed tests. The
current task is to finish the existing Academy release economically, not expand
features, replace platforms, repeat historical diagnostics, or reopen curriculum.

**Evidence baseline:** application revision
`a68c86b823ee5c9e5c0d8e42b1d4ce2269eb7458` (PR #128).
This documentation update does not alter that application code.

### Verified work to preserve

| Item | Evidence and actual scope |
| --- | --- |
| Phase One owner access repair | PR #128 merged. Exact PR head `57eb89b0479682b3dea30d15cb8ac82d893593a9` passed portal CI 44984447642: application/type/build verification, database acceptance, isolated repair checks, protected public output. Lesson acceptance 44984447665 passed. |
| Published application | Post-merge portal CI 44984814014 and Pages deployment 44984813123 passed. Vercel production `dpl_AfEsn57S6ctaoEQTP6a989x8jEGU` is READY on the same merged application revision. |
| Live owner flow | Signed-in Edge opened the production Phase One curriculum, which listed six journeys, 36 lessons and six workbook links. Lesson 5.4 opened; its audio advanced past 14 seconds, reported duration 287.975771 seconds and no media error, and was paused afterward. Open Workbook reached Journey Five / Lesson 5.4, page 13 of 24. No answers were entered or saved. |
| Protected Phase Two preview | Retain the dated authenticated playback/caption/denied-access evidence below. It is preview evidence and sampled playback, not production protection or an every-asset viewing pass. |
| Media recovery | Retain the 594-file original-hash restore and 6m35s live recovery receipt from run 44926966979. Automatic backup 44961330505 also completed successfully, including the policy/recovery step. No extra recovery run is required merely to recreate this conversation's evidence. |
| Operational execution | Diagnostic run 44991807709 and coding-worker run 44991930814 succeeded. Success shows those jobs executed; it does not establish that a real learner fault was repaired end to end. |

**Reporting correction:** saying that this session opened all 36 Phase One
lessons exceeded the observed evidence. All 36 were listed; the exercised lesson
was 5.4. A green test count, READY deployment, successful connection or owner-only
sample must never be reported as proof that the entire Academy is launch-ready.

### Existing release gates and their closure evidence

1. **Protected production delivery and public-copy withdrawal — open.**
   Existing private-media transfer and protected preview are complete as recorded.
   Production delivery activation, domain routing, Pages retirement, repository
   privacy and release protection must be coordinated. Verify authorized access
   and denial through old Pages/raw/direct media routes after the switch.
   Domain inspection confirms the apex still uses GitHub Pages addresses and
   GoDaddy nameservers. Vercel currently has the checkout subdomain and its default
   domain; the Academy apex is not yet attached. Preserve rollback capability
   without restoring public paid-media delivery. Registrar access is pending;
   inspection authorization alone is not DNS-change authorization.
2. **Economical private operation — assessed, not activated.**
   Basic private repositories are available on GitHub Free. Advanced private
   release protection and Actions usage are separate decisions, not a fee for
   privacy or a requirement to buy another storage service. The current diagnostic
   schedule is four times hourly and triggers the coding worker each time.
   Sample jobs took 85 and 111 seconds, each rounding to two billed minutes under
   current GitHub rules. At 96 pairs/day for 30 days that is 11,520 minutes,
   approximately $69.12 gross at $0.006/minute, before included compute allowance.
   This is a projection for that schedule/sample, not measured monthly usage or
   a current bill; backups, builds, storage and other usage are excluded. It
   does not authorize a plan, budget increase or paid service. Any reduction
   must preserve approved monitoring, repair authority, checks and recovery.
3. **Final learner/recovery acceptance on the released configuration — open.**
   Reuse existing enrollment, payment, email, timer, saved-work and isolation
   receipts where their contracts remain unchanged. Identify only evidence
   invalidated by the delivery switch or still absent. Owner review is not an
   ordinary learner session. Final acceptance must demonstrate the ordinary
   sign-in-to-authorized-media/workbook path, saved work and access boundaries
   on the actual released configuration, and close the previously recorded
   incident-to-recovery evidence gap within the approved repair authority.
   Learner/assistant trials, invitations, payments or intentionally injected
   production faults must not be started silently. The founder retained control
   of when those trials begin.

### Continuation rule

Continue from these gates, not another general diagnostic restart. A closed item
may be reopened only with a named changed dependency, reproduced regression or
specific missing acceptance evidence. Record that reason alongside the item.
Do not describe older draft entries as newly discovered defects or infer a
provider failure from a stale pending note. Do not guarantee incident-free
operation or declare launch readiness until the named live release gates close.

Current pricing references (reviewed November 22):
- https://docs.github.com/en/get-started/learning-about-github/githubs-plans
- https://docs.github.com/en/billing/reference/actions-runner-pricing
- https://docs.github.com/en/billing/reference/product-usage-included

---


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

## Shared learner sign-in and return - November 2, 2026

The homepage's existing Learner sign in link remains `/learn/`. Its shared entry
restores the existing browser session, then reads only that signed-in account's
enrollments through the normal client and RLS. A Phase One-only learner continues
to the existing Phase One learning home. A Phase Two-only learner continues to
`/learn/?course=phase-two`. A learner with both enrollments chooses a phase.
No local navigation hint grants access; each phase still enforces its own
enrollment, publication, payment and lesson restrictions. A failed enrollment
lookup offers retry rather than assuming Phase One. Sign-out/account changes
discard the earlier account's pending routing result.

Without a saved session, the shared entry uses the existing enrollment-email
sign-in form and optional existing-password method. Email sign-in does not create
an account and returns to the shared entry after verification. Enrollment access
is provisioned by the existing confirmed-payment or authorized trial flow.

Restoring a session is different from opening a lesson. The learning home shows
the learner's server-calculated progress, available lessons and released saved
work. Clicking Open lesson begins or resumes its existing study session; the
shared entry does not open teaching or start a timer. Closing a browser normally
retains the session on that device, but sign-out, cleared site data, private
browsing or an expired session can require sign-in again. It is not permanent
access based on an email address or merely a connection to the API.

Explicit phase, lesson, workbook, owner-review and trial links retain their
existing routes. Owner administration stays at `/control-center/` and continues
to require the existing server-controlled owner permission. A saved learner
session is not evidence of owner permission, and navigation does not change it.

## Enrollment administration

### Staged learner review - November 4, 2026

Preparation does not activate an enrollment. Explicitly staged Phase One review
access has status `pending`, no `starts_at`, and the service-controlled
`learner_start_pending` flag. Sign-in and reload show **Begin Phase One** without
loading curriculum or starting a lesson. Only that deliberate action calls the
ownership-checked `begin_aca_learner_enrollment` RPC, sets the start time once and
opens the existing founder welcome, ChatGPT orientation and first-lesson sequence.
Ordinary unpaid pending records cannot opt into this control. Existing active
learners and paid-enrollment activation keep their established behavior.

New trial invitations still allocate no enrollment when prepared or mailed.
Their first redemption anchors the lesson calendar to the later of the
owner-selected start and actual redemption, preserving the owner-set expiry.
Repeat invitations resume existing access and cannot restart the calendar.
Verification must leave staged real learner accounts waiting; exercise Begin
only with synthetic fixtures unless the founder explicitly authorizes a start.

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


## Active study correction — October 31, 2026

Terrence's controlling requirement is a 120-minute study allowance preserved across pauses, logout, browser closure, power loss and emergencies. Thirty minutes of study followed by an hour away must leave 90 minutes. The October 8 fixed elapsed deadline contradicted that requirement. PR #102 contains the correction; PR #103 updates the existing retained Phase Two controller source. The current launch continuity record identifies the actual deployment state; a PR alone is not proof of publication.

The candidate uses the existing phase ledgers, server-owned millisecond accounting, authenticated session tokens, a 30-second heartbeat and a 45-second confirmation lease. Manual Pause, hidden/closed pages and connection loss preserve unused minutes. Five minutes without interaction triggers an automatic pause with a warning in the last 30 seconds; playing lesson audio/video counts as activity. This five-minute interval is an implementation default, not a recovered founder-approved policy. No browser can determine the precise instant a person physically leaves. Long unconfirmed gaps are not charged. Resume does not reset the allowance. Saved work, payment cutoffs, existing owner extensions and the Phase Two Saturday-through-Sunday exception remain separate controls.

Do not claim the release calendar has been corrected by the timer patch. Terrence subsequently specified independent enrollment starts, daily release at 6 a.m. Pacific, and 24 hours to first open an ordinary lesson. That first-opening window is not a 6–8 a.m. lesson and is not an elapsed two-hour completion window. Phase Two has six release days and a Saturday extension through Sunday. Phase end must follow the final lesson's applicable boundary, not an unrelated 42-day default. The present cohort-based calendar still requires alignment with those instructions. Do not request a Monday start date or treat the existing cohort implementation as an approved founder decision. Preserve prior evidence and update the existing continuity mandate with actual deployment and test status before closing the task.


The October 31 isolated ordinary-learner acceptance used fictional data and the actual candidate browser-to-Supabase path. It verified preserved minutes and drafts across manual pause, browser reload and closure, an actual five-minute inactivity warning/pause, exhausted teaching access, and a saved workbook edited after exhaustion and retained on reload. A positioned stale-running record verified return without charging its unconfirmed absence. Thirty-minute/hour-away values were positioned test records, not a real hour-long browser wait. No physical-phone, real power/network outage or real lesson-media playback was claimed.

Payment integration checks found and corrected a fractional-cutoff defect before production: temporary payment restriction must preserve the underlying unused study budget so bringing payment current restores otherwise eligible access. Added regression checks cover that boundary in both phases. The legacy heartbeat adapter also starts an already-open pre-token record once, preserving remaining minutes for cached readers during rollout; it cannot create a lesson opening by itself. The Saturday extension retained its calendar boundary, was restricted by the payment cutoff, and resumed that same boundary after the fictional payment status was brought current. No real charge or email was sent.

The current portal CI verifies the correction against the existing phase contracts. A final heartbeat confirming Phase One exhaustion must durably record the closed budget before returning, so eligibility cannot reappear when a confirmation lease becomes stale. This is covered by a dedicated regression gate. Retained Phase Two source d5a71ac27c3f5164e2d96bcd53ecdc10b733aa3a passed CI 41186369785 and supplies index-D2LwPTTN.js. Publish the CI-built public HTML and all changed dependencies through the existing GitHub Pages route, apply the exact tested migration, and verify the served artifacts and applied functions before claiming installation. The disposable database was deleted and verified absent after approximately 49 minutes; its cleanup backstop was disabled after deletion. Existing production course publication, payment dates, prices and backup operation must remain unchanged. Calendar/24-hour first-opening/final phase-end alignment is still separate pending launch work.


## Independent release calendar - October 31, 2026 candidate

Terrence confirmed that Lesson 1 opens immediately with the enrollment link, including after 6 a.m. or on Sunday. Later Phase Two lessons release at 6 a.m. America/Los_Angeles on Monday-Saturday; they do not require a shared Monday cohort. The actual calendar Saturday receives the extension through Sunday, ending Monday at 00:00 Pacific, even when its lesson number is not .6. Phase One keeps its configured release offsets, anchored to Pacific calendar dates and 6 a.m.; completion no longer adds an extra day of delay.

The first-opening window is 24 elapsed hours after ordinary release. Already-open saved study budgets remain independent of that opening cutoff. Unopened missed lessons cannot be opened by direct RPC. Phase end is calculated from the final lesson's applicable boundary: an unopened final lesson ends at its opening cutoff; an opened ordinary final lesson retains its saved allowance until completion/exhaustion. Existing explicit owner/trial end dates remain hard limits. New paid enrollments do not receive an unrelated 42/90-day default. Historical enrollment dates and work are not rewritten.

`private.aca_lesson_calendar` is shared by both access paths, workbook release visibility, Phase Two notice candidates and owner diagnostics. Historical cohort metadata may remain attached for compatibility but no longer determines release timing. New Phase Two checkout retains the course-publication and enrollment-date gate; the course stays draft until separately authorized. Legacy already-created Checkout sessions with cohort metadata remain fulfillable.

Candidate only until the current continuity record confirms release. `operations/lesson-calendar-db-check.sh` runs PostgreSQL calendar, DST, first-opening, resume, final-boundary, saved-work and ownership checks using synthetic data. Its minimal fixture does not cover the full Supabase owner/trial schema; complete isolated Supabase acceptance before production. No curriculum/media, price, installment date or backup change is authorized by this calendar correction.


## Direct navigation standard — November 7, 2026

Tabs and links used for navigation open a separate page or replace the selected panel. They must not scroll through stacked sections. Place the selected heading and controls comfortably in the viewport immediately; preserve normal reading scroll, browser Back, accessibility skip links, learner work and study-time rules.

The assistance/resources review branch applies this to public section links through `site.js` (`?section=...`, including legacy hash bookmarks), three AI guidance views under Resources, Phase One My Workbooks, owner section navigation and compact-screen learner detail views. Inputs and their handlers are retained in public focused views. Invalid destinations retain the overview.

Phase Two's maintained source baseline is commit `b1b91386e53d8a217ec4342d3b8ec323adb44bbd` on `phase-two-curriculum-strengthening`. Its unchanged Vite build reproduced the existing `index-D2LwPTTN.js` and `index-Bj4AawGd.css` exactly. Apply `portal/patches/phase-two-direct-navigation.patch` to that baseline to reproduce the navigation-only controller correction and regression test. Rebuild with `vite build --config portal/vite.config.ts`: the corrected entry is `index-PM6hlVKZ.js`; CSS and other assets remain unchanged. The original entry stays available for rollback. The patch keys the existing instant page-start helper to view, workbook journey and lesson destination; saving, metadata refresh and study timer updates do not reset the view.

Verification for this candidate: public section selection and legacy links, isolated workbook view, owner navigation/focus, and the retained Phase Two source regression suite. Browser acceptance covers public preview views at desktop and mobile widths. Protected learner and owner routes use synthetic test fixtures; this does not claim a live enrolled lesson was opened.


### Ask ACA public entry — November 7, 2026

Terrence clarified that asking a question must require no sign-in, email link
or special access. The current review candidate uses the normal public website
page `/ask/`, linked from the primary navigation and Books & Resources. It uses
the same published answer catalog, matches questions in the browser and makes
no model, email, enrollment or lesson request. The added Ask ACA authentication
flow and return hints are removed; the old query route redirects to `/ask/`.
The public preview includes this page. Existing learner and owner authentication
are unchanged. PR 113 remains the review/release boundary.

### Ask ACA AI activation — November 7, 2026

Terrence approved the existing OpenAI credits for approximately 50 learners.
Public Ask ACA now sends questions to the dedicated public support endpoint after
its visible OpenAI disclosure; course sign-in remains unchanged. AI selects only
published guidance, and failures use local answers. Both support endpoints share
a service-only atomic $20 conservative monthly allowance (2,000 reserved attempts).
The key is server-only. Automatic credit purchases are off; the additional
subscription-credit offer is unclaimed. No autonomous repairs or account changes
are enabled. Current verification/release status is on PR 113.


## Owner navigation restored — November 20, 2026

The public homepage includes an **Owner** navigation link to /control-center/.
The shared site.js adds the same link to public page navigation when absent.
The existing owner entry opens with email/password sign-in and verifies the
server-controlled owner permission before opening the control center, where
**Curriculum & releases** provides lesson and media inspection. This change
restores the entry point. Authenticated owner curriculum review was not exercised
with a live owner session during this navigation correction.


## Readiness correction reconciliation — November 20, 2026

The prior review combined actual defects, incomplete work and verification gaps.
These are distinct. Journey Three's standalone welcome is explicitly obsolete
under academy/AGENTS.md; no missing introduction should be recreated. Journey Two
already starts with its approved 2.1 recording in the construction route. The
learner dashboard now opens the corresponding first lesson through its existing
access checks for Journeys Two/Three, avoiding a draft/duplicate entry.

Journeys Four–Six retain their existing separate draft welcome records. The saved
September working master explicitly describes unfinished recordings and a later
founder review/recording decision. There is no evidence that their standalone
welcomes were retired; do not generalize Journey Three's decision to them or
produce replacement curriculum without that decision. All installed .1 lessons
remain unchanged. The draft status is not evidence that approved lessons vanished.

The approved November founder welcome publication runs against its exact existing
private object and records success only after upload/readback. Consult the
service-only `aca_media_publications` ledger for the actual result.

Phase Two direct asset files remain exposed through the public repository/Pages
origin. Removing page links cannot protect those bytes or Git history. A complete
correction requires private media delivery plus withdrawal of public repository
access; preserve existing playback until that coordinated cutover can be made.
Moving the roughly 1.05 GB Phase Two package into the existing private backup
scope would exceed its approved 2 GiB bound (current private files roughly 1.65
GB before this welcome update). Do not silently exceed the backup limit or remove
existing backup coverage. Supabase leaked-password protection also requires its
authentication configuration surface; database SQL is not that setting.

The existing Owner link and password entry are installed. No authenticated owner
or learner trial, charge, invitation, case, or assistant-recovery exercise was
started during this correction. Terrence controls when those trials begin.


### Confirmed publication and remaining access boundary

Revision ab1753b12ab556988ea6426bea8ceae876be5ec5 installed the bounded support
release workflow, deployment reconciliation and the Journey Two/Three dashboard
entry correction. Portal CI 44725845475 completed successfully, including its
database and credential-free container gates. Both Vercel project status checks
reported success. The served /learn/ and /control-center/ HTML plus every newly
referenced compiled file matched the released bytes. The existing coding setting
is enabled and auto_release_enabled is true. No support case, trial, invitation
or charge was created to exercise this installation. Publication evidence is
separate from proof that an assistant repaired a real learner's problem.

At that checkpoint, the approved welcome was not uploaded (superseded by the
verified dashboard-correction result below). The runner rendered 78,414,881 bytes,
verified decode and original AAC narration, and preserved the 44,355,028-byte
original as a private rollback copy. Standard and TUS uploads both returned 413;
the 200 MiB bucket limit is not sufficient to explain the rejection, so inspect
the project-wide Storage setting. The live object still has its October 6
revision. Workflow 44725561276 failed safely; the service-only ledger says failed.
After correcting the effective size limit, dispatch approved-welcome-publication
for the same approved asset and require verified readback before reporting success.

The Supabase dashboard is signed out in the available browser. Connected database
SQL tools do not expose project Auth/Storage configuration. GitHub file writes
work, but repository visibility settings require administrator UI access. Do not
ask Terrence to reconnect functioning file/database connectors or paste credentials.

Earlier completion records were scoped: ACA_Current_Work_Checkpoint.docx records
36 lessons/six workbooks and 43 storage references while explicitly excluding a
new playback review. The November 7 Academy and Curriculum Master Overview records
published phases and automated checks, explicitly excluding an every-lesson live
walkthrough. These records establish coverage limits, not evidence that later
edits removed the approved lessons. Preserve this distinction in future reports.

### Supabase dashboard corrections — November 20, 2026

Dashboard sign-in succeeded. Storage's project-wide limit was 50 MB, below the
existing 200 MB learning-media bucket limit. The project limit is now 200 MB,
verified after reload, with the spending cap retained. Compromised-password
protection is enabled; the dashboard confirms ENABLED and the security advisor
no longer reports leaked-password protection disabled. Other sign-in settings
were preserved.

The welcome replacement is now VERIFIED. Workflow 44730791650 succeeded at
11:54 UTC (19:54 Manila). The 78,416,986-byte existing live object exactly matched
the rebuilt approved render: SHA-256
e484c51eeee4523d3f325bee5115f06bd63d6d2a53ee7934538b1978ac6a2122.
The publication ledger records verified_at 2026-11-20T11:54:23.158Z. The original
44,355,028-byte rollback object and byte-identical narration remain preserved.
The runner now bypasses stale download caches and can verify a completed upload
without replacing it again. Its conservative alternative comparison checks every
frame and exact timing/narration before accepting an equivalent encoder output;
that alternative was not needed for the final exact-hash success. Four focused
recovery/safety tests pass. The synthetic FFmpeg check accepted identical frames
and rejected a different encoding below the strict threshold. All three groups
in portal CI 44730791547 passed for source revision
067d02cf8d9139fd2b5b12c45fcbc224fdee768f. No authenticated learner playback is claimed.

Repository settings remain inaccessible in the signed-out GitHub browser.
Automatic approval review rejected opening GitHub sign-in because the explicit
browser authorization covered Supabase. Obtain separate GitHub administrator
sign-in authorization before proceeding there. The functioning GitHub file-write
connection does not need reconnection. Phase Two public-media protection remains
pending; preserve live playback and the existing 2 GiB backup limit. No learner
trial, enrollment start, invitation, support case, or payment was initiated.

### Launch defect repairs — November 21, 2026

Terrence authorized correcting the launch defects, preserving the existing
program and learner records. Phase One Journey Five had 24 stored workbook
pages, but pages 13–24 used `page` instead of the renderer's `number` key.
A guarded production update changed exactly one definition: all 24 pages now
have their original page numbers, and removing the 12 added keys reproduces
the original JSON exactly. The existing saved-response count and digest were
unchanged. The API now normalizes legacy keys before field/access filtering
and rejects ambiguous or duplicate numbers. Regression coverage saves and
reopens pages 13, 17, 21 and 24, retains an earlier answer, and rejects unreleased
pages. No enrollment, timer, invitation or payment was started for this repair.

The owner lesson inspector now follows the learner's Phase Two introduction
selection (validated revised manifests for 1.1–1.4, landscape 2.1, wide Journey
Six) and reads outcomes from `phase_two_production.outcomes`. Its Phase Two
calendar label now describes individual enrollment and Pacific-time releases.
Tests cover revised, landscape, wide and ordinary introductions.

The completion correction separates truly completed lessons from missed or
expired lessons. Closed lessons still advance the existing calendar and retain
released workbook access. When every lesson is closed but some were not
completed, the existing `access_ended` response replaces the false completion
claim. The migration changes only the derived read function, not learner rows.
Its disposable PostgreSQL fixture covers missed, expired, mixed and complete
courses, ownership and released workbook access. The dashboard explains ended
access without calling it completion. Local type checking, portal/backend/
recovery tests and the build passed; publication and production migration
verification must be recorded after the remote gates pass.

Phase Two public-media withdrawal remains a separate unfinished repair. Do not
mark the Academy launch-ready from these corrections, expose private copies,
disable GitHub Pages before checking account support, or exceed the existing
2 GiB backup bound. Continue with repository privacy, private playback and
backup verification before withdrawing the currently used public assets.

The initial repair revision `7cfdf33f4654ab6761c7f172dcb216d1b0a9e177` passed
all three portal CI jobs in run 44880839806, the Phase Two Lesson 1.1 acceptance
run 44880839709, and the Vercel preview build. The completion function was then
applied successfully under Supabase migration version `20261121073655`; the
repository filename follows that recorded server version. The three existing
lesson-window records retain their exact pre-repair digest, and both anonymous
and authenticated roles remain denied direct access to the private function.
A replay of all six actual Phase One workbook definitions through the repaired
handler returns every stored page (32, 26, 24, 24, 24, 24). This replay is not
a claim of a newly started learner session.

#### Production verification of the November 21 repairs

PR 122 merged as `511c6b68b9606bc3b0d79a8cb00628f775be3c10` after all
three CI gates passed on final repair revision
`37a75959ca74686d430db89f9484bc5c11279ff5` (run 44881237978). The additional
Phase Two acceptance job passed (44881237994). Post-merge portal CI also passed
all three jobs (44881643911). Local checks passed 187 portal, 247 backend and
153 recovery tests; the optional live invitation test remained skipped.

GitHub Pages deployment 44881643810 succeeded. Vercel production deployment
`dpl_5J5jwh5ntpY6Stv2uDmFNgP3YDyx` became READY and owns the checkout domain.
The served learning and control-center HTML plus all six new referenced scripts
matched the committed bytes. Live health returned 200; anonymous owner and
workbook requests still returned 401.

The signed-in owner control center displays the corrected individual-enrollment
calendar label. Every one of its 36 Phase Two lesson inspections was opened:
all returned six media entries (introduction, guided audio, four demonstrations)
and nonempty recorded outcomes. The revised 1.1–1.4, landscape 2.1 and wide
6.1–6.6 introductions match the learner selection. Lesson 6.6's six media
players loaded metadata with nonzero durations and no browser media errors.
This verifies inspector rendering and metadata, not a full watch of every film
or a newly enrolled learner's entire program. No learner timer was started.

The next unresolved repair is private Phase Two media delivery and withdrawal
of its public repository/Pages copies. The GitHub file connector works; the
administrator browser is at GitHub sign-in. Account plan and Pages behavior
must be checked before repository privacy changes. Do not break the live site,
raise the existing backup transfer limit, or mark media protected prematurely.
The current owner authorization covers defect corrections; the remaining
administrator sign-in requires the account holder, not another repair approval.
## November 21, 2026 — private media and hosting repair staged

Working branch: `repair/private-media-production`; production activation remains
pending the capacity and cutover gates below. No learner enrollment, payment,
lesson window, curriculum record, domain, repository visibility, or production
service plan was changed by this preparation.

Phase Two source is recovered from the documented baseline
`b1b91386e53d8a217ec4342d3b8ec323adb44bbd` into this same maintained codebase,
including its required existing test fixtures and direct-navigation patch.
`portal/src/phaseTwoMain.tsx` now builds both existing Phase Two entry routes;
`portal/index.html` no longer depends on a manually named historic bundle.
Existing Phase One changes remain intact. Do not apply the historical navigation
patch again to the restored source.

`ACA_PRIVATE_PHASE_TWO_MEDIA=true` enables a read-only media endpoint which checks
the verified user, exact active enrollment, existing user-scoped lesson access RPC,
published lesson and phase before signing only that lesson's catalogued objects.
Owner review uses the server owner check without opening a study window. The
portal resolves recordings, captions, posters and metadata through private links,
renews expiring links while retaining the lesson subtree and playback position,
and refuses public fallback. Published learner media uses the same existing
recordings currently selected in owner review; this repairs missing learner media
plans for lessons after 1.1 without editing teaching, transcripts or database rows.

`ACA_PUBLIC_SITE=true` additionally builds an allowlisted public Vercel artifact;
it requires private-media mode. Construction/API authentication remains intact.
Paid media directories and obsolete portal builds are excluded, with explicit
denial of the old asset routes. Public marketing assets are served statically,
outside the backend function package. Editorial generation is now an explicit
`npm run build:content` task to preserve committed approved public pages.

Migration inventory: 525 files, 1,048,800,956 bytes, with original Git blob hashes
verified against main. Existing private storage was 1,729,388,971 bytes; combined
source is 2,778,189,927 bytes before encrypted-manifest overhead. The actual backup
and retry bound remains 2,147,483,648 bytes. The migration tool defaults to a
read-only plan and refuses uploads that exceed the enforced backup/retry bounds.
It verifies every source before writing, never overwrites an existing object, and
checks downloaded destination bytes against the original Git hash.

Continuation: obtain approval for a 4 GiB source/encrypted backup bound, including
the matching retry bound and at least 12.5 GiB private temporary space; verify the
runtime budget and capacity. Transfer to existing private Supabase storage, then
run the existing encrypted backup and complete restore/hash verification. Only
then enable production media, validate authorized/denied playback and captions,
validate all public/enrollment routes on the existing Vercel project, cut over the
domain, disable GitHub Pages, make the repository private with appropriate branch
protection, and verify old Pages/raw URLs no longer expose the files. Preserve a
rollback deployment; never restore public paid-media delivery as a rollback.

Local evidence is automated fixture/build evidence, not live learner playback.
One opt-in live trial fixture remains skipped. Preview flags are scoped only to
this repair branch. The Academy must not yet be described as launch-ready.

Reviewable implementation: draft PR #123,
https://github.com/teeleebiz-web/aiconfidenceacademy-site/pull/123.
The branch preview at
https://aiconfidenceacademy-site-mkvf-7fysqv8xc.vercel.app/
built successfully on the existing paid Vercel project. Its home and learner
entry returned 200; the former Lesson 1.1 public introduction path returned 404;
the private-media endpoint without a token returned 401; backend health returned
200. Browser review confirmed the home-to-programs navigation and both signed-out
sign-in presentations. No sign-in email, purchase or learner timer was triggered.
These observations do not verify authenticated private playback before migration.

Local validation: 561 portal tests passed, with one opt-in live trial skipped;
267 backend/media acceptance checks and 159 recovery/release checks passed.
Type checking and both default and secure public builds passed. The old Lesson
1.1 acceptance workflow now resolves the maintained application's build manifest
instead of hard-coding a retired bundle. Release reconciliation supports the
planned Vercel-only mode while still requiring exact served hashes and backend
health; the matching GitHub repository variable remains unset pending cutover.

Final failure-path review additionally verified that a failed signed-link renewal
pauses playback and clears media URLs while retaining the mounted project form.
An authorized retry restores recording access and playback position without
discarding unsaved notes. All six private-media component regressions passed;
type checking, default build, secure public build and its four boundary checks
passed again for this correction. Sign-out still removes the protected subtree.

## November 21, 2026 — backup capacity approved

Terrence explicitly approved increasing the coordinated backup limits to 4 GiB
and continuing the private transfer and full recovery verification. This
supersedes the pending-capacity approval above. `operations/backup-limits.mjs`
now supplies the shared source, encrypted-transfer, retention-read and retry
bounds. The disk preflight requires 13,421,772,800 available bytes (12.5 GiB).
The existing retry count, five-minute cooldown, ten-minute retry deadline,
30-minute workflow ceiling, seven daily copies and pinned original are preserved.

The existing manual backup workflow has an explicit Phase Two transfer input,
default false. An approved run validates recovery configuration and disk before
copying, checks all source hashes before any write, refuses overwrites, verifies
each destination, and then performs the existing full encrypted backup/restore.
The same concurrency group excludes overlap with automatic backups. A successful
copy alone never activates media, changes hosting or establishes launch readiness.
Production media/hosting flags remain off until recovery and access checks pass.

Live read-only preflight confirms 69 current private objects totaling
1,729,388,971 bytes. The latest scheduled backup, run 44791318648, completed full
restore/hash checks with that same collection, retained seven copies and
preserved the original. Existing recovery credentials are recorded valid through
October 25, 2027. The 525 additional objects remain pending this approved run.

## November 21, 2026 — private transfer format correction

PR #123 merged as `a9c4a751635eb398700999f4c37a50168ef299ea` after CI
passed (562 portal checks, one opt-in skip; 267 backend and 162 recovery checks;
SQL and isolation checks passed). Manual run 44907767786 verified the disk
preflight with 91,668,598,784 available bytes, then stopped after eight exact
objects (2,576,167 bytes). The existing private bucket allowed MP4 and captions
but excluded the catalog's M4A audio (`audio/mp4`); WebP and JSON were also absent.
No full backup was created by that failed run. Originals and production delivery
flags were unchanged. Do not rerun that old revision.

The migration now preflights every required format before uploads. With the
existing explicit transfer approval, it uses the supported Storage API to append
only missing exact catalog formats, preserving existing formats, the private
setting and the 200 MiB file limit. It checks for configuration drift and verifies
the settings readback before uploading. Read-only plan/verify modes never update
settings. All source hashes still pass before the first settings or object write.
Fixed local error messages identify the failure without printing provider bodies.

Continuation: release this narrow correction after recovery tests and CI; dispatch
a new manual transfer/backup run on that reviewed main. Resume by validating the
eight existing objects; do not overwrite them. Require all 525 hashes and the
complete 594-object, 2,778,189,927-byte encrypted backup/restore proof before any
production delivery activation. The Academy is not yet launch-ready.

## November 21, 2026 — private inventory complete; transcript boundary hardened

PR #124 merged as `71510cfdd78c97b5445154d7802fcb6d621472a1`. All CI
checks passed at head `810d05b9effc439b75da76bd60bc25f1f299d712`: 562 portal,
267 backend and 165 recovery tests, plus SQL and container isolation. Vercel
production deployment `dpl_EhHMgVET7gpYHqZYLZ2dyNMuBQQL` is READY with
production media/hosting flags still unset.

The new approved manual transfer/backup run is 44908917519, on that exact main:
https://github.com/teeleebiz-web/aiconfidenceacademy-site/actions/runs/44908917519
Live private Storage now contains all 525 Phase Two objects (1,048,800,956 bytes)
and all 69 originals: 594 objects totaling 2,778,189,927 bytes. The bucket remains
private, retains its 209,715,200-byte per-file limit and its original MIME types,
with audio/mp4, application/json and image/webp added. Anonymous requests to the
new object's public and authenticated Storage routes returned no file bytes.
The R2 upload is at `aca-backups/ea568319-00f3-4c8e-a6ac-02b5b630b25c`.
Full recovery completed successfully at 13:47:37 UTC (21:47 Manila) on November 21.
All four flags are true: liveAcaBackup, uploadedAndReadbackVerified,
savedCopyDecryptionVerified and restoredWithOriginalHashesVerified. The receipt
confirms 594 files, 2,778,189,927 source bytes and 2,778,444,848 encrypted artifact
bytes. The transfer resumed without overwrites: 517 new uploads and 525 exact Git
hashes verified. The complete encrypted copy was downloaded, decrypted and
restored to a fresh private directory with all original hashes verified.

The protected public build also exposed 11 original introduction modules in
JavaScript. All 15 original/revised introduction values now share one canonical
server-side JSON source; SHA-256 tests preserve every byte from main 71510cf.
The existing authorized media response returns only the selected lesson's text.
Private clients have no public-text fallback. The current public mode preserves
its existing wording until cutover. Protected builds remove the legacy catalog,
and an independent output guard rejects text fingerprints in public JS/HTML/JSON.
CI runs that protected build after preserving the current release artifact.
No lesson words, recordings, publication states, enrollment or clocks changed.

Local validation passed: 565 portal tests (one opt-in live trial skipped), 270
backend tests, 165 recovery tests, type checking, default build and protected
public build. All 36 private lesson fixtures retain their existing instructor
version, guided audio and four demonstrations. Branch-specific preview flags
apply only to `repair/protected-introduction-delivery` on the existing project.
The Edge connection became unavailable during the run. Live signed-in owner
playback/captions therefore remain unverified; do not manufacture a user session.

Remaining launch gates: reconnect Edge for authorized owner playback; complete
the existing Vercel public-route checks and approved hosting cutover; disable
Pages and make the source repository private with appropriate branch protection.
Public originals are still accessible until that coordinated cutover. No new
subscription, repository-visibility change, domain change or production flag
activation has been performed. The Academy is not yet launch-ready.

## November 21, 2026 — recovery timing and transcript release

PR #125 merged as `7bbd227a5821fc561c834a26289c11fec6212483` after CI
44910608482 passed all 1,000 automated tests, SQL, isolation and the protected
public build. Preview deployment `dpl_94TjkUPGzkK1979dKrri7Yp9rvMY` is READY:
https://aiconfidenceacademy-site-mkvf-fxpvbuxhu.vercel.app/
Its home, learner entry and backend health returned 200. The private media API
without a session returned application JSON 401. The old paid-media path returned
404; the canonical introduction source route returned 401 with no transcript.
Downloaded entry and Phase Two JavaScript contained zero protected introduction
fingerprints. This is HTTP/build evidence, not signed-in owner playback.

The successful full backup took 12 minutes 35 seconds after migration finished.
That fits the normal 30-minute job but exceeds the existing 10-minute retry
deadline. The capacity increase alone therefore does not establish adequate retry
runtime. Preserve the deadline, one extra attempt, five-minute cooldown and all
byte bounds. The narrow transfer correction overlaps at most three R2 artifact
operations; source reading/encryption and retention remain unchanged. Every file
still gets uploaded and read back exactly once. Download still checks every
ciphertext hash, authenticates/decrypts the manifest and restores original hashes.
A failure stops scheduling, awaits all active streams and only then permits local
cleanup. No completion marker can be published from a partial transfer.

Local acceptance: all 168 recovery tests passed, including three concurrent
transfers, completion ordering, no additional requests, stopped scheduling after
failure and cleanup only after all writers settle. Live timing remains pending.
After reviewed release, run the existing manual backup workflow on main with
`migrate_phase_two_media=false`: the approved media is already present. Require
the same 594-file/full-restore receipt and completion comfortably inside ten
minutes. Do not claim the runtime problem solved from fixture tests alone.
Edge is disconnected; reconnection was requested once and remains the access
blocker for dispatching that run and completing signed-in owner playback.


## November 22, 2026 — live recovery timing verified

Edge access was restored without reinstalling or reconnecting the browser.
The approved manual backup ran on reviewed main
`336c87cf47ad1799026be42d5bf69605775224e0`, with media migration disabled:
https://github.com/teeleebiz-web/aiconfidenceacademy-site/actions/runs/44926966979
Job 136915068844 passed all 168 recovery checks before the live operation.
The backup/restore step ran from 16:54:15 to 17:00:50 UTC on November 21
(00:54:15 to 01:00:50 Manila on November 22): 6 minutes 35 seconds.
The complete workflow took 8 minutes 4 seconds, including setup. The live
backup step is 6 minutes faster than the preceding 12-minute-35-second run
and leaves 3 minutes 25 seconds inside the existing ten-minute retry deadline.
This demonstrates runtime at the current collection size, not a guarantee of
future provider latency or proof of a naturally triggered automatic retry.

The receipt confirms all four recovery flags true, 594 files,
2,778,189,927 original bytes and 2,778,444,848 encrypted artifact bytes.
The saved copy is `aca-backups/2fc27b0d-1014-4399-b780-22511a85beeb`.
Every file was uploaded/read back, downloaded, decrypted and restored with
its original hash verified. No media migration, source overwrite, retention
change, retry-limit change, hosting cutover or access activation occurred.

Vercel production deployment `dpl_DnpxCQGenoF6bRrcfafDG13d5P3f` is READY on
that same main revision. The checkout health endpoint returned 200 with
`aca-backend` / `ok`; the public learner entry returned 200.
The existing production Control Center opens with protected owner access.
The separate protected preview opens successfully but requests an Academy
sign-in. Its owner playback/caption check remains pending that sign-in:
https://aiconfidenceacademy-site-mkvf-fxpvbuxhu.vercel.app/learn/?course=phase-two
Do not transfer authentication storage or manufacture a user session.
The preview sign-in tab and successful recovery run were left available.

Next: finish signed-in owner playback/captions, then complete the remaining
coordinated public-hosting and repository protection gates under the applicable
explicit activation approval. Public originals still exist until cutover;
this recovery result does not establish overall launch readiness.

Owner sign-in continuation: Terrence explicitly asked Knowledge to perform the
sign-in. The normal preview email-link request delivered successfully, but its
return address was the live `/learn/` page. The current app correctly requests
its own origin. Signed-in Supabase URL Configuration shows the live learner URL
as Site URL and an empty redirect allowlist, explaining the fallback. The
existing Supabase account sign-in was completed using its linked ChatGPT identity.
The exact preview `/learn/` callback above is staged in Add new redirect URLs;
no authentication settings have been saved. Browser action-time confirmation
was requested for temporarily allowing that exact callback, with removal after
testing. An existing-password sign-in is the alternative. No wildcard redirect,
credential extraction, session transfer, new account or role grant was used.

## November 22, 2026 — authenticated owner review publication mismatch

Terrence approved the temporary exact preview `/learn/` callback. It was saved
in Supabase without changing Site URL or adding wildcards. The generic learner
entry sent a correctly routed email and the existing owner's normal email-link
sign-in succeeded. The Phase Two-specific entry includes a query string and
does not match that exact callback; use the generic entry for this temporary
check. Remove the approved temporary callback after testing as agreed.

The signed-in owner review then reproduced `Your lesson could not load`.
Current database metadata confirms the course, all six journeys and all 36
lessons are published (18 video / 18 audio). The owner-only review query and
its completeness validator still required draft status. The new regression
reproduced that precise failure before correction. Owner review now accepts
only draft or published courses, with all child records required to match the
course's state. The default draft validation contract remains strict, and
all sequencing, teaching-source and media-allocation checks remain in force.
Owner authorization and RLS run before curriculum queries as before. No
publication, content, enrollment, payment or learner timer is changed.

Local targeted validation: 55 tests passed and TypeScript checking passed.
The source repair still requires full CI and authenticated playback in its
updated protected deployment before claiming the browser check passed.

## November 22, 2026 — owner review repair verified in CI and merged

PR #127 merged as `bc148a6f6e9f0ccdd8b1b178e335e3b04e61b83d`.
Exact head `1b43d6c1c40f3a7c2acacc4766a2f73ce3de553d` passed CI
44929544153: 569 portal, 270 backend and 168 recovery tests (1,007 total;
one opt-in live trial skipped), TypeScript, SQL, container isolation and the
default and protected-output builds. The source regression was reproduced
before repair. The local full portal run initially lacked public JavaScript
files because the new checkout was sparse; after including those original
files, the affected three tests passed. CI used the full repository and passed.

Protected preview `dpl_2oqA2wCgoctcE9iT1uNpFinv8q1M` is READY on that head:
https://aiconfidenceacademy-site-mkvf-gmlvnen2h.vercel.app/learn/?review=phase-two&lesson=1.1
HTTP checks returned 200 for home, owner-review entry and backend health;
401 for unauthenticated private media and the canonical introduction source;
404 for the old paid-media path. These checks do not prove signed-in playback.

The Edge control connection timed out twice after the successful owner sign-in
and observed review failure on the older preview. No browser actions were
attempted through a different browser. The exact temporary Supabase callback
`https://aiconfidenceacademy-site-mkvf-fxpvbuxhu.vercel.app/learn/` remains present:
cleanup was attempted as a read of its settings page, but no removal occurred.
Do not claim it was removed. Terrence's existing approval includes its removal
after testing; do not ask again for that cleanup. No wildcard or other callback
was added. The newer deployment's address was not added or approved.

Continuation: when the selected Edge connection responds, remove the older
temporary callback, finish authenticated review/playback/captions on the corrected
protected preview, and verify the source release on the live owner surface.
Preserve normal sign-in; never copy browser sessions or manufacture credentials.
Production private-media and public-hosting activation remains pending the
coordinated cutover; public originals still exist. Overall launch readiness is
not established. The previously verified 6m35s full recovery remains valid.

## November 22, 2026 — browser recovery and Phase One owner-access repair

This entry supersedes the pending browser/callback status above. Edge recovered.
After the founder approved the corrected preview's exact callback, normal email
sign-in succeeded there. Both the older `fxpvbuxhu` callback and corrected
`gmlvnen2h` callback were removed after testing. Supabase URL configuration now
shows no extra redirect URLs; its production Site URL remains unchanged.

On protected deployment `dpl_2oqA2wCgoctcE9iT1uNpFinv8q1M`, authenticated
Phase Two review loaded all 36 lesson choices and six workbooks. Actual playback
was observed for the revised 1.1 introduction and guided audio, its first demo
(to ended), and introductions 2.1 and 6.6. Native captions visibly rendered on
1.1. Lesson 1.2 and final-lesson audio/demo metadata loaded; this is not full
playback coverage of every asset. Journey Six workbook opened to Lesson 6.6.
No workbook responses, progress, enrollment, payment or timing records changed.
Twenty-one protected preview routes returned expected pages. An unsigned media
request was denied and the old paid-media URL returned 404. Production originals
remain publicly reachable until the coordinated delivery/repository cutover.

Cross-phase navigation exposed a distinct Phase One defect: the verified owner
was rejected when no active/pending/completed learner enrollment was returned.
Owner review now obtains a separately authorized course context using existing
owner RLS. No synthetic enrollment is created. Explicit review and workbook
navigation bypass learner start/onboarding gates; ordinary learner access remains
on its existing enrollment path. Owner lessons remain read-only and signed-media
protected. Dashboard labels owner review accurately. No database migration or
curriculum modification is involved. The applied course/journey/lesson owner
policies were inspected and confirmed before this correction.

New regression tests reproduced the blocked owner curriculum/workbook and staged
review before repair. Local validation passes 576 portal tests (one opt-in live
trial skipped), 270 backend tests, 168 recovery tests, TypeScript and default
build. Initial local failures were missing sparse-checkout assets; original
files were restored, without changing tests to skip those checks. Generated
portal/control-center entries accompany the source for current Pages delivery.
Full hosted SQL/isolation/protected-build validation and the actual source
release/browser verification remain pending for this new correction.

Cutover dependencies inspected: external DNS still points to GitHub Pages and
uses GoDaddy nameservers. The source repository remains public and has no branch
rules. The account is GitHub Free; its displayed Pro offer is $4/month with
private protected branches and 3,000 Actions minutes/month. Current 15-minute
incident diagnostics trigger the isolated repair worker. Sample jobs took
82 and 88 seconds respectively (runs 44983128204 and 44983247701); private
Actions usage needs a budget/capacity assessment before changing visibility.
No plan purchase, DNS change, repository visibility change or hosting activation
has been made. The founder approved GoDaddy inspection; normal sign-in is needed.
The earlier automatic access denial was not bypassed. The full 594-file recovery
proof remains valid and was not repeated. Launch readiness remains unestablished.
