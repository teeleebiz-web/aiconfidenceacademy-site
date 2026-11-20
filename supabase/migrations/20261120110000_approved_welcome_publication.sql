-- Execution ledger for the founder-approved welcome replacement. Media URLs stay service-only.
create table public.aca_media_publications (
  publication_key text primary key,
  source_url text not null,
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  original_sha256 text not null check (original_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'approved' check (status in ('approved','publishing','verified','failed')),
  output_sha256 text,
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.aca_media_publications enable row level security;
revoke all on public.aca_media_publications from public, anon, authenticated;
grant select, update on public.aca_media_publications to service_role;
