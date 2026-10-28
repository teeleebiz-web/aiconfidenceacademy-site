-- Add only the approved Phase Two amounts; preserve all existing plans and RLS.
alter table public.aca_installment_plans
 drop constraint aca_installment_plans_total_amount_check,
 drop constraint aca_installment_plans_paid_amount_check,
 drop constraint aca_installment_plans_next_amount_check;
alter table public.aca_installment_plans
 add constraint aca_installment_plans_total_amount_check check (total_amount in (14900,19900)),
 add constraint aca_installment_plans_paid_amount_check check (paid_amount between 0 and total_amount),
 add constraint aca_installment_plans_next_amount_check check ((total_amount=14900 and next_amount in (4900,5000)) or (total_amount=19900 and next_amount in (6600,6700)));
