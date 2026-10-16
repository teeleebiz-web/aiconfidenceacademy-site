-- Owner API checks the live private allowlist before calling this service-only reader.
create or replace function public.aca_control_history(p_section text,p_offset integer default 0,p_phase integer default 0,p_scope text default 'operational',p_search text default '') returns jsonb
language sql stable security definer set search_path='' as $$
with filtered as (
 select * from private.aca_control_enrollment_rows r where (p_phase=0 or r.phase_number=p_phase)
 and (p_scope='all' or(p_scope='sandbox' and r.payment_mode='sandbox') or(p_scope='operational' and r.payment_mode<>'sandbox' and coalesce(r.record_label,'')<>'fixture'))
), records as (
 select to_jsonb(x) row,x.created_at stamp,x.id::text key from (select em.id,em.enrollment_id,em.recipient,em.subject,em.template_key,em.status,em.attempts,em.sent_at,em.delivered_at,em.created_at,em.provider_message_id,left(em.last_error,300) last_error from public.aca_email_events em where p_section='emails' and (em.enrollment_id in(select id from filtered) or(p_phase=0 and p_scope='all'))) x
 union all
 select to_jsonb(x),x.created_at,x.stripe_event_id from (select ev.stripe_event_id,ev.stripe_session_id,ev.customer_email,ev.amount_total,ev.currency,ev.status,ev.event_type,ev.livemode,ev.outcome,ev.created_at,ev.processed_at,left(ev.error_message,300) error_message from public.aca_payment_events ev where p_section='payments' and (ev.customer_email in(select email from filtered) or(p_phase=0 and p_scope='all'))) x
 union all
 select to_jsonb(x),x.updated_at,x.provider_refund_id from public.aca_refunds x where p_section='refunds' and (p_scope='all' or(p_scope='operational' and x.livemode) or(p_scope='sandbox' and not x.livemode)) and (p_phase=0 or x.customer_email in(select email from filtered))
 union all
 select to_jsonb(x),x.created_at,x.id::text from (select id,allowed_email,course_id,cohort_id,starts_at,expires_at,status,enrollment_id,created_at,updated_at from public.aca_trial_grants where p_section='trials' and (p_phase=0 or course_id in(select id from public.courses where phase_number=p_phase))) x
 union all
 select to_jsonb(x),x.created_at,x.id::text from public.aca_learner_feedback x where p_section='feedback' and (x.enrollment_id in(select id from filtered) or(p_phase=0 and p_scope='all'))
 union all
 select to_jsonb(x),x.occurred_at,x.id::text from public.aca_owner_activity x where p_section='activity' and (x.enrollment_id in(select id from filtered) or x.enrollment_id is null)
), matching as (select * from records where p_search='' or row::text ilike '%'||left(p_search,100)||'%')
select jsonb_build_object('total',(select count(*) from matching),'rows',coalesce((select jsonb_agg(row order by stamp desc,key desc) from (select * from matching order by stamp desc,key desc limit 50 offset greatest(0,p_offset)) page),'[]'));
$$;
revoke all on function public.aca_control_history(text,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.aca_control_history(text,integer,integer,text,text) to service_role;
