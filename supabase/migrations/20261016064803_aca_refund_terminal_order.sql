-- Stripe timestamps have one-second precision. A same-second pending event cannot reverse a terminal result.
create or replace function public.aca_record_refund(p_refund jsonb,p_created bigint) returns void
language sql security invoker set search_path='' as $$
 insert into public.aca_refunds(provider_refund_id,charge_id,customer_email,amount,currency,livemode,status,event_created_at)
 values(p_refund->>'provider_refund_id',p_refund->>'charge_id',p_refund->>'customer_email',(p_refund->>'amount')::int,p_refund->>'currency',(p_refund->>'livemode')::boolean,p_refund->>'status',p_created)
 on conflict(provider_refund_id) do update set charge_id=excluded.charge_id,customer_email=coalesce(excluded.customer_email,public.aca_refunds.customer_email),amount=excluded.amount,currency=excluded.currency,livemode=excluded.livemode,status=excluded.status,event_created_at=excluded.event_created_at,updated_at=now()
 where public.aca_refunds.event_created_at<excluded.event_created_at
 or (public.aca_refunds.event_created_at=excluded.event_created_at
 and (public.aca_refunds.status not in ('succeeded','failed','canceled') or excluded.status in ('succeeded','failed','canceled')));
$$;
revoke all on function public.aca_record_refund(jsonb,bigint) from public,anon,authenticated;
grant execute on function public.aca_record_refund(jsonb,bigint) to service_role;
