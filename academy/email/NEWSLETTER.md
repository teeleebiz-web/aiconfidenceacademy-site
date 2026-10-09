# ACA optional updates: interests and weekly delivery

The live signup offers multiple choices: Phase One (enrollment information), Videos, Books & Resources, and ACA updates (Academy news and AI notes). Existing single-interest records in `aca_update_subscriptions` retain their original interest via a read fallback. Historical `aca_interest_list` records are not imported or reclassified.

## Delivery

The existing daily maintenance at 18:00 UTC synchronizes optional subscribers and prepares weekly editions. Each completed week produces a separate broadcast for each category with new published material. Broadcasts require both the existing ACA Learning Updates segment and the appropriate opt-out-by-default Resend topic. A person choosing multiple categories may receive one message per selected category with new content. Empty weeks do not send.

`newsletter-interests.mjs` defines the four topics and content routing. New videos route to Videos. Newly published books and Explore resources route to Books & Resources. Published `content/public-hub.json` updates default to ACA updates. For an enrollment announcement, set `newsletter_category` to `Phase One` on its published update entry. Use the exact category names for any explicit override. Write the public announcement first; the system does not invent enrollment dates or AI news. Existing books/resources are baselined once, not announced as new.

Original weekly editions remain in place. `aca_newsletter_interest_editions` holds a durable broadcast record per week/category using the established dispatch state machine. A retry cannot blindly recreate an uncertain broadcast or resend a recorded submission. Native provider topic/global opt-outs are respected. Each category is enabled from explicit signup selection once; routine sync never re-enables a previously activated topic after a native opt-out. The welcome unsubscribe link stops all optional ACA updates.

## Boundaries

Payment notices, lesson releases, and enrollment invitations retain their existing sender, credentials, records, and tests. Optional preferences do not control those transactional messages. RLS protects both optional subscription and edition tables; only server credentials can access them.

The approved separate production `ACA_NEWSLETTER_RESEND_KEY` is installed. The operational `RESEND_API_KEY` is unchanged. The approved business mailing address is stored in `aca_newsletter_state.settings`. Newsletter sending uses `newsletter_from` separately from the operational sender; this configures a sending identity, not a receiving mailbox.

Resend's current plan permits three segments. ACA routing uses topics in its existing ACA segment, requiring no plan change. An empty ACA Video Updates segment was created during capability verification but is unused; no preexisting segment was removed.

## Verification

Run `node --test academy/email/*.test.mjs academy/server.test.mjs academy/enrollment/*.test.mjs`. Check the live signup, topic preferences, `aca_newsletter_state.last_run`, and dispatch records after deployment. Existing original test records must remain unchanged. Use new task-specific provider test addresses for live checks.
