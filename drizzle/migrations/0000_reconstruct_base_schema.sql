create schema if not exists private;

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.branches to authenticated;
grant all on public.branches to service_role;
alter table public.branches enable row level security;

create table if not exists public.merchant_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  role text not null default 'staff',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, merchant_id, branch_id)
);
grant select, insert, update, delete on public.merchant_memberships to authenticated;
grant all on public.merchant_memberships to service_role;
alter table public.merchant_memberships enable row level security;

create or replace function public.is_merchant_member(_merchant_id uuid, _branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.merchant_memberships mm
    where mm.user_id = (select auth.uid())
      and mm.merchant_id = _merchant_id
      and mm.status = 'active'
      and (_branch_id is null or mm.branch_id is null or mm.branch_id = _branch_id)
  )
$function$;

create or replace function public.is_merchant_manager(_merchant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.merchant_memberships mm
    where mm.user_id = (select auth.uid())
      and mm.merchant_id = _merchant_id
      and mm.status = 'active'
      and mm.role in ('owner', 'admin')
  )
$function$;

create policy "Members can read own memberships"
on public.merchant_memberships for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage memberships"
on public.merchant_memberships for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Merchant managers can manage memberships"
on public.merchant_memberships for all to authenticated
using (public.is_merchant_manager(merchant_id))
with check (public.is_merchant_manager(merchant_id));

create policy "Admins can manage branches"
on public.branches for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Merchant members can read own branches"
on public.branches for select to authenticated
using (public.is_merchant_member(merchant_id, null));

create policy "Merchant managers can manage branches"
on public.branches for all to authenticated
using (public.is_merchant_manager(merchant_id))
with check (public.is_merchant_manager(merchant_id));

create table if not exists public.merchant_payment_methods (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  provider text not null,
  label text not null,
  phone_number text not null,
  ussd_template text not null default '*712*{phone}*{amount}#',
  logo_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.merchant_payment_methods to anon;
grant select, insert, update, delete on public.merchant_payment_methods to authenticated;
grant all on public.merchant_payment_methods to service_role;
alter table public.merchant_payment_methods enable row level security;

create policy "Anyone can view active payment methods"
on public.merchant_payment_methods for select to anon, authenticated
using (is_active = true);

create policy "Admins can manage payment methods"
on public.merchant_payment_methods for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  label text not null,
  device_type text not null default 'table_mini',
  public_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  status text not null default 'active',
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.devices to authenticated;
grant all on public.devices to service_role;
alter table public.devices enable row level security;

create policy "Admins can manage devices"
on public.devices for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Merchant members can read own devices"
on public.devices for select to authenticated
using (public.is_merchant_member(merchant_id, null));

create policy "Merchant managers can manage devices"
on public.devices for all to authenticated
using (public.is_merchant_manager(merchant_id))
with check (public.is_merchant_manager(merchant_id));

create table if not exists public.payment_sessions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  payment_method_id uuid references public.merchant_payment_methods(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  device_id uuid references public.devices(id) on delete set null,
  provider text not null,
  amount numeric not null,
  currency text not null default 'USD',
  status text not null default 'initiated',
  source text not null default 'tap2pay',
  initiated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.payment_sessions to anon;
grant select, insert, update, delete on public.payment_sessions to authenticated;
grant all on public.payment_sessions to service_role;
alter table public.payment_sessions enable row level security;

create policy "Admins can manage payment sessions"
on public.payment_sessions for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Merchant members can read own payment sessions"
on public.payment_sessions for select to authenticated
using (public.is_merchant_member(merchant_id, null));

create or replace function public.confirm_payment_session(_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_merchant_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select ps.merchant_id into v_merchant_id from public.payment_sessions ps where ps.id = _session_id;
  if v_merchant_id is null then raise exception 'Session not found'; end if;
  if not (public.has_role((select auth.uid()), 'admin'::public.app_role) or public.is_merchant_manager(v_merchant_id)) then
    raise exception 'Not authorized to confirm this session';
  end if;
  update public.payment_sessions
  set status = 'manual_confirmed', confirmed_at = pg_catalog.now(), confirmed_by = (select auth.uid()), updated_at = pg_catalog.now()
  where id = _session_id and status = 'initiated';
  if not found then raise exception 'Session is not awaiting confirmation'; end if;
end;
$function$;
revoke all on function public.confirm_payment_session(uuid) from public, anon;
grant execute on function public.confirm_payment_session(uuid) to authenticated;

create or replace function public.cancel_payment_session(_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_merchant_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select ps.merchant_id into v_merchant_id from public.payment_sessions ps where ps.id = _session_id;
  if v_merchant_id is null then raise exception 'Session not found'; end if;
  if not (public.has_role((select auth.uid()), 'admin'::public.app_role) or public.is_merchant_manager(v_merchant_id)) then
    raise exception 'Not authorized to cancel this session';
  end if;
  update public.payment_sessions
  set status = 'cancelled', updated_at = pg_catalog.now()
  where id = _session_id and status = 'initiated';
  if not found then raise exception 'Session is not awaiting confirmation'; end if;
end;
$function$;
revoke all on function public.cancel_payment_session(uuid) from public, anon;
grant execute on function public.cancel_payment_session(uuid) to authenticated;

create table if not exists public.sms_readers (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  label text not null,
  status text not null default 'pending',
  last_sync_at timestamptz,
  last_seen_at timestamptz,
  device_model text,
  device_manufacturer text,
  android_version text,
  app_version text,
  sim_last4 text,
  paired_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.sms_readers to authenticated;
grant all on public.sms_readers to service_role;
alter table public.sms_readers enable row level security;

create policy "Admins can manage sms readers"
on public.sms_readers for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Merchant members can read own sms readers"
on public.sms_readers for select to authenticated
using (public.is_merchant_member(merchant_id, null));

create policy "Merchant managers can manage sms readers"
on public.sms_readers for all to authenticated
using (public.is_merchant_manager(merchant_id))
with check (public.is_merchant_manager(merchant_id));

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'expense',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.expense_categories to authenticated;
grant all on public.expense_categories to service_role;
alter table public.expense_categories enable row level security;

create policy "Admins can manage expense categories"
on public.expense_categories for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  sms_reader_id uuid references public.sms_readers(id) on delete set null,
  direction text not null,
  provider text not null,
  amount numeric not null,
  currency text not null default 'USD',
  counterparty text,
  counterparty_name text,
  tx_id text,
  occurred_at timestamptz not null default now(),
  source text not null default 'sms_reader',
  verification_state text not null default 'unverified',
  review_state text not null default 'needs_review',
  dedupe_key text unique,
  message_excerpt text,
  category_id uuid references public.expense_categories(id) on delete set null,
  sms_body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.financial_transactions to authenticated;
grant all on public.financial_transactions to service_role;
alter table public.financial_transactions enable row level security;

create policy "Admins can manage financial transactions"
on public.financial_transactions for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Merchant members can read own financial transactions"
on public.financial_transactions for select to authenticated
using (public.is_merchant_member(merchant_id, null));

insert into public.expense_categories (name, kind, sort_order) values
  ('Alaab / Inventory', 'expense', 10),
  ('Kirada / Rent', 'expense', 20),
  ('Mushaar / Salary', 'expense', 30),
  ('Koronto & Biyo / Utilities', 'expense', 40),
  ('Gaadiid / Transport', 'expense', 50),
  ('Kale / Other', 'expense', 60)
on conflict do nothing;