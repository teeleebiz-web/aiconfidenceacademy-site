# ACA operational support and policy source

The October 17, 2026 founder instruction controls this increment: prepare public launch policies, remove outdated launch-delay copy, prioritize automatic support, preserve established enrollment behavior, and leave approved curriculum untouched.

`knowledge.mjs` is the single source for automatic public answers. The build copies it to `support-knowledge.js`; do not edit the generated copy. Contact and FAQ use this same answer set. Matching runs in the browser, sends no question to an AI model, and never decides a refund or account exception. Unsupported questions route to a case. This is approved-answer automation, not a deployed generative AI agent.

`api.mjs` stores cases and messages without granting learner access. A 32-byte capability is generated in the browser; only its SHA-256 hash is stored. The initial confirmation email carries the private link. Its fragment is removed from the address bar on opening. Keep capabilities out of logs and audit metadata. Wrong or absent keys return the same unavailable response. Rate limits, body limits, a form trap, and explicit transactional contact consent protect intake. Supabase anon/authenticated roles have no direct table permissions. Owner actions require the existing authenticated allowlist check. Requester email is not verified identity and must never authorize disclosure of a learner's account records.

Support & feedback in the control center includes website cases and the existing learner reports. Owner replies are reviewed before sending. Delivery uses the existing operational sender and event history with idempotency keys. New requests and follow-ups notify trusted owner addresses obtained through a service-only lookup, without putting case bodies in the alert. A saved case remains available when email fails; do not describe failed email as successful delivery. Actual delivery remains separate from provider submission.

Incoming domain MX was absent when checked October 17. No support mailbox address is published by this increment and no DNS or existing sender configuration is changed. The website case route is the working contact channel. The older Microsoft 365 mailbox plan remains historical infrastructure context; do not infer mailbox availability from sending verification.

New checkouts require the named agreement field and exact policy version. Stripe Checkout and installment subscription metadata retain the policy version and server acceptance timestamp. Existing sessions and webhook fulfillment remain compatible; no historical agreement is invented. Offers remain $129 Founding Student Price or $50/$50/$49 totaling $149. This is not a new test of the completed enrollment flow.

Public source pages: Terms, Refund Policy, Privacy, Accessibility, AI Learning Disclaimer, Contact, FAQ, and the enrollment disclosures. These are operational policies prepared from ACA records, not an attorney opinion or a claim of legal certification. Keep required consumer remedies intact. Any qualified legal review must assess the actual operator, offering, jurisdictions, exemptions, and practices; do not advertise universal legal compliance.

Research consulted October 17:
- California DOJ, Making Your Privacy Practices Public: https://oag.ca.gov/sites/all/files/agweb/pdfs/cybersecurity/making_your_privacy_practices_public.pdf
- California DOJ, CCPA rights and applicability: https://oag.ca.gov/privacy/ccpa
- FTC, .com Disclosures: https://www.ftc.gov/system/files/documents/plain-language/bus41-dot-com-disclosures-information-about-online-advertising.pdf

Verify with the support tests, checkout consent tests, shared server/origin checks, owner UI checks, production build, and actual public contact/case behavior. Do not change curriculum publication or repeat historical payment tests as part of this work.

## October 17 verified release continuation

PR 59 merged as 69bb2f8142b18cada9a4d20991bd303950472f6d. Production backend deployment dpl_EXpCwmLUVgrcC33bVMsrVqAXbQxZ is READY. PR CI passed. Browser verification on the official Contact page matched the refund answer, created the controlled operational case 3c892ff7, and displayed its saved case and private link. Signed provider events record both the support confirmation and the trusted-owner alert as delivered. No enrollment, payment, publication, or curriculum record was altered for this verification. The supplied support email remains unverified identity and cannot authorize account disclosure.

A small public interface follow-up handles private links clicked within the already-open Contact page as well as initial navigation, removes the credential fragment, strengthens heading hierarchy, and versions the public assets. It does not change the backend or support authority. Verify private-link reopening and requester follow-up on the official site after that update. Keep the controlled test case distinct from a customer request.

Remaining backend work is not relabeled complete: generative AI support, administrative role delegation and MFA, restoration proof, broader operational alert/retry coverage, qualified legal review, and the final launch acceptance evidence. Do not restart completed enrollment tests or inspect approved curriculum while continuing these operations.

## Backend reliability continuation October 17

Delivery callbacks now apply allowed status transitions in the database UPDATE,
including the current provider message reference. A concurrent or late `sent`
callback cannot overwrite `delivered` or a failure; repeated delivery preserves
the recorded delivery timestamp. Failure evidence remains visible for review.
The focused rollback-only check is `academy/email/delivery-status-acceptance.sql`.

Installment maintenance distinguishes newly submitted reminders from recorded
reminder markers. A failed marker write leaves the reminder eligible for retry;
the existing email event prevents another send when that retry records the
marker. Provider and database failures are counted in its result, including
partial pause writes, so System activity records a warning instead of a false
success. Payment amounts, due dates, correction period, and access rules are
unchanged. Nested newsletter failures and uncertain provider outcomes likewise
produce warnings; intentional disabled or empty-edition holds remain normal.

The existing CI workflow now checks backend, API entry, database migrations,
and deployment configuration changes in addition to portal changes. This work
improves recorded failure visibility and retry accounting. It does not complete
proactive incident notifications, generic automatic email replay, generative AI
support, role delegation/MFA, restoration proof, legal review, or final launch
acceptance. Continue with those existing plan items; do not recreate the policies
or reopen the approved curriculum.

## Proactive operational alerts October 17

`academy/email/operational-alerts.mjs` connects failed or partial daily automation
runs to trusted-owner notification emails. It uses the same service-only owner
recipient lookup as support; recipients are checked again at dispatch. Alerts
include only a task label, time, reference, and the existing control-center link.
They never include raw job results, provider errors, learner details, or private
access links. A daily task/reason/recipient key groups repeated reports.

`/api/operations/maintenance` runs daily at 21:00 UTC (05:00 the next day in
Manila). It checks the existing 09:00, 16:00, and 18:00 UTC jobs, allowing two
hours for invocation and flagging unfinished recorded runs after fifteen minutes.
It does not run those tasks or change their schedules. The activation baseline
prevents old missing-run alerts. It also dispatches pending notifications;
ordinary task completions can retry those notifications too.

The service-only queue uses five-minute exclusive leases and conditional claim
tokens. Definite send failures retry after fifteen minutes on a later scheduled
invocation, up to three attempts. An uncertain submission uses the same immutable
message and provider key only within 23 hours of its first attempt, inside
Resend's documented 24-hour retention. Older unconfirmed sends and delivery failures
remain for review. A provider reference prevents another send even if delivery
later fails. Submission is distinct from delivered provider callbacks.
The age guard applies even when a later attempt was rejected: that rejection
does not disprove acceptance of an earlier attempt whose response was lost.

System activity includes the monitor's result and alert dispatch counts in task
results. Email center's all-records collection includes owner notification email
events. Use those records to investigate; do not rerun financial jobs or change
access merely because an alert arrived. The queue is not a generic retry engine
for customer emails, and a resolved underlying task does not erase prior failures.

Verification uses the focused unit/route tests and rollback-only
`academy/email/operational-alerts-acceptance.sql`. The latter checks service-only
permissions, RLS, logical dedupe, exclusive claims, lease recovery, and stale
claim rejection without retained fixtures or email. This monitor shares Vercel,
Supabase, and Resend with the application: it cannot independently detect its own
failure or guarantee delivery during an outage of those services. Independent
outage monitoring and actual isolated backup restoration remain separate work.

## Phase Two enrollment configuration — October 28, 2026

Approved pricing: Phase One pay-in-full $129 versus $50/$50/$49 ($149 total);
Phase Two pay-in-full $179 versus $67/$66/$66 ($199 total). Every new enrollee
qualifies for the $20 pay-in-full saving; no special eligibility or code is needed.
Keep legacy Phase One Stripe price IDs and checkout records fulfillable.

Phase Two routes are `/api/enrollment/phase-two/paid-in-full` and
`/api/enrollment/phase-two/installments`. Configure the existing course through
`ACA_PHASE_TWO_COURSE_ID`, its approved active cohort through
`ACA_PHASE_TWO_COHORT_ID`, and the four dedicated price IDs named in
`operations/recovery.env.example`. Only the $179 and initial $67 prices open
checkout. The $199 standard price records the offer comparison, not an extra
public payment choice. The two $66 installments use the same weekly price.

Checkout refuses to create a Phase Two payment unless its existing course is
published, its enrollment dates allow it, and its configured cohort is active.
This implementation does not publish that course, create a cohort, choose a start
date, or change curriculum. Pricing can be displayed while enrollment stays closed.
Before activation, confirm the actual cohort schedule and access period, verify
Phase Two learner entry and its protected curriculum, and complete the isolated
Stripe sandbox purchase/retry/invitation acceptance flow. Do not label these
provider checks complete based on unit tests.

Signed checkout events resolve the course from configured Stripe prices, validate
Phase Two metadata/amount, preserve the session cohort through fulfillment, and
send its `/learn/?course=phase-two` entrance. Existing memberships cannot be
reassigned by another purchase. Invoice reconciliation uses the saved plan total
and dates; Phase One payment amounts remain unchanged. The installment table
accepts only the approved $149/$199 totals and their corresponding next amounts.
