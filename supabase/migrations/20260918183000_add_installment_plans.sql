create table if not exists public.aca_installment_plans (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users(id) on delete restrict,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  customer_email text not null,
  stripe_customer_id text,
  stripe_subscription_id text not null unique,
  stripe_schedule_id text not null unique,
  stripe_first_invoice_id text,
  status text not null check (status in ('active', 'grace', 'paused', 'completed', 'canceled')),
  total_amount integer not null default 14900 check (total_amount = 14900),
  paid_amount integer not null default 5000 check (paid_amount between 0 and 14900),
  payments_completed integer not null default 1 check (payments_completed between 1 and 3),
  second_due_at timestamptz not null,
  third_due_at timestamptz not null,
  next_due_at timestamptz,
  next_amount integer check (next_amount in (4900, 5000)),
  grace_until timestamptz,
  reminder_sent_for_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aca_installment_plans_due_idx
  on public.aca_installment_plans (status, next_due_at);
create index if not exists aca_installment_plans_grace_idx
  on public.aca_installment_plans (status, grace_until);

alter table public.enrollments drop constraint if exists enrollments_status_check;
alter table public.enrollments add constraint enrollments_status_check
  check (status in ('pending', 'active', 'completed', 'expired', 'cancelled', 'refunded', 'paused'));

alter table public.aca_installment_plans enable row level security;
revoke all on public.aca_installment_plans from public, anon, authenticated;
grant select, insert, update on public.aca_installment_plans to service_role;

create or replace function public.set_aca_installment_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists aca_installment_plans_updated_at on public.aca_installment_plans;
create trigger aca_installment_plans_updated_at
before update on public.aca_installment_plans
for each row execute function public.set_aca_installment_updated_at();

revoke execute on function public.set_aca_installment_updated_at() from public, anon, authenticated;
