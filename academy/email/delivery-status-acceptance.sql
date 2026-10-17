-- Check real database UPDATE predicates without sending mail or retaining fixtures.
begin;
do $$
declare mail uuid:=gen_random_uuid();provider text:='aca-delivery-check-'||gen_random_uuid();changed int;delivered timestamptz:=now()-interval '1 minute';begin
 insert into public.aca_email_events(id,event_key,template_key,recipient,subject,status,provider_message_id)
 values(mail,'delivery-check:'||mail,'verification','disposable@example.test','Rollback-only delivery verification','sent',provider);
 -- Simulate another callback committing after a stale "sent" lookup.
 update public.aca_email_events set status='delivered',delivered_at=delivered where id=mail;
 update public.aca_email_events set status='sent' where id=mail and provider_message_id=provider and status in ('queued','sending','sent');
 get diagnostics changed=row_count;assert changed=0,'Late sent update must not regress delivery';
 update public.aca_email_events set status='delivered',delivered_at=now() where id=mail and provider_message_id=provider and status in ('queued','sending','sent');
 get diagnostics changed=row_count;assert changed=0,'Duplicate delivery must preserve its original timestamp';
 assert (select status='delivered' and delivered_at=delivered from public.aca_email_events where id=mail);
 update public.aca_email_events set status='bounced',last_error='Verification bounce' where id=mail and provider_message_id=provider and status in ('queued','sending','sent','delivered');
 get diagnostics changed=row_count;assert changed=1,'Actual failure after delivery must remain visible';
 update public.aca_email_events set status='delivered',last_error=null where id=mail and provider_message_id=provider and status in ('queued','sending','sent');
 get diagnostics changed=row_count;assert changed=0,'Late delivery cannot erase failure evidence';
 update public.aca_email_events set status='delivered' where id=mail and provider_message_id=provider||'-older' and status in ('queued','sending','sent');
 get diagnostics changed=row_count;assert changed=0,'An older provider reference cannot update a newer attempt';
 assert (select status='bounced' and last_error='Verification bounce' and delivered_at=delivered from public.aca_email_events where id=mail);
end $$;
rollback;
select 'Delivery, duplicate timestamp, failure, and provider-reference guards passed; fixture rolled back and no email sent.' as result;
