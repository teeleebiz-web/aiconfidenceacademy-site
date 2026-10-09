-- PROPOSAL ONLY. NOT APPLIED. Requires explicit activation approval.
-- No historical records are imported, excluded, or modified by this proposal.
-- No enrollment/payment lookup is needed: separate sending processes use the
-- same normalized email, and only explicit opt-ins enter the optional store.
update public.aca_newsletter_state
set value=value || '{"contact_sync_enabled":true,"subscription_store":"aca_update_subscriptions","topic_id":"b5614546-57b7-4804-80ea-b814ad786794","delivery_enabled":false,"cadence":"weekly_published_content"}'::jsonb,
    updated_at=now()
where id='settings';
-- Public delivery additionally requires the real mailing address and activation.
