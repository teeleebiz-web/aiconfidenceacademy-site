begin;
create table public.aca_book_titles (
 id uuid primary key default gen_random_uuid(), slug text not null unique,
 title text not null, author text not null default 'Terrence Lee', description text not null default '',
 created_at timestamptz not null default now()
);
create table public.aca_book_editions (
 id uuid primary key default gen_random_uuid(), title_id uuid not null references public.aca_book_titles(id),
 format text not null check(format in ('ebook','audiobook')),
 status text not null default 'draft' check(status in ('draft','published','retired')),
 amount integer check(amount > 0), currency text not null default 'usd' check(currency ~ '^[a-z]{3}$'),
 stripe_test_price_id text unique, stripe_live_price_id text unique,
 version text not null default '1', created_at timestamptz not null default now(),
 unique(title_id,format,version), check(status <> 'published' or amount is not null)
);
create table public.aca_book_files (
 id uuid primary key default gen_random_uuid(), edition_id uuid not null references public.aca_book_editions(id),
 object_path text not null unique check(object_path !~ '(^/|\.\.|://)'),
 display_name text not null, mime_type text not null, size_bytes bigint not null check(size_bytes > 0),
 position integer not null default 0, created_at timestamptz not null default now()
);
create table public.aca_book_orders (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 edition_id uuid not null references public.aca_book_editions(id), buyer_email text not null,
 amount integer not null check(amount > 0), currency text not null,
 price_id text not null, livemode boolean not null,
 stripe_session_id text unique, stripe_payment_intent_id text unique,
 status text not null default 'pending' check(status in ('pending','paid','refunded')),
 created_at timestamptz not null default now(), paid_at timestamptz
);
create table public.aca_book_access (
 user_id uuid not null references auth.users(id), edition_id uuid not null references public.aca_book_editions(id),
 livemode boolean not null, order_id uuid not null references public.aca_book_orders(id),
 status text not null check(status in ('active','revoked')),
 primary key(user_id,edition_id,livemode)
);
create table public.aca_book_email_outbox (
 id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.aca_book_orders(id),
 recipient text not null, status text not null default 'pending' check(status in ('pending','sent')),
 provider_message_id text, created_at timestamptz not null default now()
);
create index aca_book_editions_title_idx on public.aca_book_editions(title_id);
create index aca_book_files_edition_idx on public.aca_book_files(edition_id);
create index aca_book_orders_user_idx on public.aca_book_orders(user_id);
create index aca_book_orders_edition_idx on public.aca_book_orders(edition_id);
create index aca_book_access_order_idx on public.aca_book_access(order_id);
create index aca_book_access_edition_idx on public.aca_book_access(edition_id);
alter table public.aca_book_titles enable row level security;
alter table public.aca_book_editions enable row level security;
alter table public.aca_book_files enable row level security;
alter table public.aca_book_orders enable row level security;
alter table public.aca_book_access enable row level security;
alter table public.aca_book_email_outbox enable row level security;
revoke all on public.aca_book_titles, public.aca_book_editions, public.aca_book_files,
 public.aca_book_orders, public.aca_book_access, public.aca_book_email_outbox from anon, authenticated;
grant all on public.aca_book_titles, public.aca_book_editions, public.aca_book_files,
 public.aca_book_orders, public.aca_book_access, public.aca_book_email_outbox to service_role;
grant select on public.aca_book_orders, public.aca_book_access to authenticated;
create policy aca_book_orders_own_read on public.aca_book_orders for select to authenticated using(user_id = (select auth.uid()));
create policy aca_book_access_own_read on public.aca_book_access for select to authenticated using(user_id = (select auth.uid()));

create function public.aca_fulfill_book_order(p_order_id uuid, p_session_id text, p_payment_intent_id text,
 p_amount integer, p_currency text, p_livemode boolean) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare o public.aca_book_orders;
begin
 select * into o from public.aca_book_orders where id=p_order_id for update;
 if not found or o.stripe_session_id is distinct from p_session_id or o.amount <> p_amount
  or o.currency <> p_currency or o.livemode <> p_livemode or p_payment_intent_id is null then
  raise exception 'Book payment does not match the order';
 end if;
 if o.status in ('paid','refunded') then return false; end if;
 update public.aca_book_orders set status='paid', paid_at=now(), stripe_payment_intent_id=p_payment_intent_id where id=o.id;
 insert into public.aca_book_access(user_id,edition_id,livemode,order_id,status)
 values(o.user_id,o.edition_id,o.livemode,o.id,'active')
 on conflict(user_id,edition_id,livemode) do update set order_id=excluded.order_id,status='active';
 insert into public.aca_book_email_outbox(order_id,recipient) values(o.id,o.buyer_email) on conflict(order_id) do nothing;
 return true;
end $$;
revoke all on function public.aca_fulfill_book_order(uuid,text,text,integer,text,boolean) from public, anon, authenticated;
grant execute on function public.aca_fulfill_book_order(uuid,text,text,integer,text,boolean) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('aca-bookstore-files','aca-bookstore-files',false,52428800,
 array['application/pdf','application/epub+zip','audio/mpeg','application/zip'])
on conflict(id) do nothing;
commit;
