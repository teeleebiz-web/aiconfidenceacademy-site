-- Follow-up to the source snapshot newsletter-schema.sql. Applied 2026-10-09 UTC.
-- Preserve all historical test records; importing awaits confirmed recipient scope.
update public.aca_interest_list set newsletter_excluded=false
where email in ('integration-test@aiconfidenceacademy.org','delivered+aca-launch-20260827@resend.dev');
update public.aca_newsletter_state
set value=value || '{"contact_sync_enabled":false}'::jsonb, updated_at=now()
where id='settings';
