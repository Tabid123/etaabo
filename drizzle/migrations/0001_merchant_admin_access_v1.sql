-- The live project also has a follow-up migration for onboarding. Keeping this
-- idempotent column guard here lets a clean install create the flag even if
-- migration history is being reconstructed.
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

-- Merchant admin access: tenant-scoped merchant/payment settings and safe transaction classification.
create policy "Merchant members can read own merchant profile"
on public.merchants
for select
to authenticated
using (public.is_merchant_member(id, null));

create policy "Merchant managers can update own merchant profile"
on public.merchants
for update
to authenticated
using (public.is_merchant_manager(id))
with check (public.is_merchant_manager(id));

create policy "Merchant members can read own payment methods"
on public.merchant_payment_methods
for select
to authenticated
using (public.is_merchant_member(merchant_id, null));

create policy "Merchant managers can insert own payment methods"
on public.merchant_payment_methods
for insert
to authenticated
with check (public.is_merchant_manager(merchant_id));

create policy "Merchant managers can update own payment methods"
on public.merchant_payment_methods
for update
to authenticated
using (public.is_merchant_manager(merchant_id))
with check (public.is_merchant_manager(merchant_id));

create policy "Merchant managers can delete own payment methods"
on public.merchant_payment_methods
for delete
to authenticated
using (public.is_merchant_manager(merchant_id));

create policy "Authenticated users can read active expense categories"
on public.expense_categories
for select
to authenticated
using (is_active = true);

create or replace function public.classify_financial_transaction(
  _transaction_id uuid,
  _category_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_merchant_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select ft.merchant_id
  into v_merchant_id
  from public.financial_transactions ft
  where ft.id = _transaction_id;

  if v_merchant_id is null then
    raise exception 'Transaction not found';
  end if;

  if not (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    or public.is_merchant_manager(v_merchant_id)
  ) then
    raise exception 'Not authorized to classify this transaction';
  end if;

  if not exists (
    select 1 from public.expense_categories ec
    where ec.id = _category_id and ec.is_active = true
  ) then
    raise exception 'Active category not found';
  end if;

  update public.financial_transactions
  set category_id = _category_id,
      review_state = 'classified',
      updated_at = now()
  where id = _transaction_id
    and direction = 'outgoing';

  if not found then
    raise exception 'Only outgoing transactions can be classified';
  end if;
end;
$function$;

revoke all on function public.classify_financial_transaction(uuid, uuid) from public;
revoke all on function public.classify_financial_transaction(uuid, uuid) from anon;
grant execute on function public.classify_financial_transaction(uuid, uuid) to authenticated;