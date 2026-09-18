create index if not exists aca_installment_plans_learner_idx
  on public.aca_installment_plans (learner_id);
create index if not exists aca_installment_plans_enrollment_idx
  on public.aca_installment_plans (enrollment_id);
create index if not exists aca_installment_plans_course_idx
  on public.aca_installment_plans (course_id);
