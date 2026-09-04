-- SECURITY DEFINER is required only to read the unexposed private allowlist.
-- Keep the function unavailable to anonymous visitors and all other roles.

revoke all on function public.is_aca_curriculum_owner() from public, anon;
grant execute on function public.is_aca_curriculum_owner() to authenticated, service_role;
