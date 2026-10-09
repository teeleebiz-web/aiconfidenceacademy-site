# ACA email separation and weekly updates

## Established boundaries

Enrollment invitations, lesson notices, and installment/payment notices continue through their existing transactional sender and `aca_email_events`. That sender does not consult newsletter preferences. Its code, existing tests, and operational records are unchanged.

Optional updates have a dedicated `aca_update_subscriptions` table. New explicit interest-form submissions write consent here. A normalized email can be an enrolled learner, a payment-plan customer, an optional subscriber, or any combination. Enrollment and payments do not imply newsletter consent. Historical interest-list test rows are not imported, deleted, disabled, or reclassified.

The existing Resend `ACA Learning Updates` segment is used only for optional mailings, with the `ACA Learning Updates` preference topic. Broadcasts must specify BOTH segment and topic. The topic's default is opt-in, but segment membership still requires an explicit optional subscription; creating a topic alone sends nothing. Provider-wide or topic-specific opt-outs are respected, never silently reversed. Unsubscribe changes only optional preferences and this segment/topic.

## Preparation and delivery

The daily protected maintenance route remains scheduled at 18:00 UTC. It collects published instructor/demonstration videos and Academy notes into one draft per UTC week. The existing ten videos and one note were baselined, not treated as new announcements.

The completed delivery module processes closed weekly editions only, uses the cream/navy/gold email template, requires a business mailing address, requires synchronized preferences, and skips empty recipient lists and empty editions. Each edition records exactly one Resend broadcast ID. Atomic claims prevent two workers from creating or sending the same edition. Ambiguous creation is held for review; uncertain sending is reconciled against the saved broadcast, not blindly resent. Resend provides native unsubscribe, delivery statistics, and suppression handling for the broadcast.

## Production state

Preparation remains active. Contact synchronization and public delivery remain OFF. Automatic approval review rejected copying a historical signup, re-enabling synchronization, and adding a read-only enrollment/payment lookup without exact approval. The safe empty-store schema was applied separately. `newsletter-routing-schema.sql` now contains only the safer, unapplied future-opt-in activation proposal. It does not copy existing records or read enrollment/payment data.

The remaining activation decision is to enable optional-subscriber synchronization and weekly delivery after the mailing address is supplied. Any historical signup migration or read-only account-status lookup requires separate approval. Existing tests remain untouched.

## Verification

Run `node --test academy/email/*.test.mjs academy/server.test.mjs academy/enrollment/*.test.mjs`.

Inspect `aca_newsletter_state.last_run`, optional subscriber sync errors, and `aca_newsletter_editions.dispatch_state`. `needs_review`, `creating`, or `sending` records must be reconciled with Resend before retrying. Never create a replacement broadcast merely because a network response was lost.
