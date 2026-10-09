# ACA subscriber updates

## Current operating mode

Preparation only. No public campaign is sent by this job. Existing learner-release and installment emails are separate and unchanged. Contact importing is also disabled (`settings.contact_sync_enabled=false`) pending confirmation of the existing records' purposes. Do not classify or exclude historical test records based on their names or addresses; they may support other operational testing.

- Public enrollment form remains connected to `aca-interest-list` in Supabase.
- Consented non-test subscribers synchronize to the Resend `ACA Learning Updates` segment.
- The daily protected maintenance route runs at 18:00 UTC. It rotates through up to ten records per run, retries failed contacts, and records its last result in `aca_newsletter_state`.
- Existing provider unsubscribes are preserved. ACA unsubscribe links remove the contact from the ACA segment without changing unrelated subscriptions or learner access. Provider unsubscribe changes are reconciled during maintenance.
- New published instructor videos and `content/public-hub.json` update entries are collected during the normal deployment build. The first run establishes a baseline; existing resources are not announced as new.
- New resources accumulate in one draft per Monday-based UTC week in `aca_newsletter_editions`. Empty weeks do not produce an edition. Approved/sent records are never rewritten.
- Resend provider contact errors are recorded without exposing addresses or credentials in the maintenance response.

## Signup welcome

The existing Edge Function retains its existing sender configuration (`ACA_FROM_EMAIL`, `RESEND_API_KEY`). It now includes a token-protected unsubscribe link, records successful sending, and uses a stable provider idempotency key. Repeat submissions preserve a prior unsubscribe. A failed or unconfigured welcome does not discard the signup. Welcome delivery is separate from campaign dispatch and must be checked in deployment verification.

## Remaining launch work

1. Confirm the public mailing frequency and approved content for the first edition.
2. Obtain the Academy mailing address for the campaign footer.
3. Finalize a cream/navy/gold campaign template and approved-edition dispatch; use Resend broadcasts with native unsubscribe, delivery tracking, and suppression support.
4. Send an approved test edition and inspect its appearance, links, unsubscribe, and delivery before enabling public sends.

No automated AI news generation is enabled. The source material is published Academy content, not unreviewed external news.

## Verification

`node --test academy/email/*.test.mjs academy/server.test.mjs academy/enrollment/*.test.mjs`

Check `aca_newsletter_state` (`catalog`, `last_run`) and `aca_interest_list.newsletter_error` after a maintenance run. The database additions were applied through the Supabase migration API under `aca_newsletter_preparation`; `newsletter-schema.sql` is the source snapshot, not a second migration to run.
