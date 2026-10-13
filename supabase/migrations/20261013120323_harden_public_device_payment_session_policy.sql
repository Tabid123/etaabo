-- Validate merchant/branch/device ownership under a SECURITY DEFINER function.
-- Anonymous payment creation must not rely on the caller being allowed to read private device/branch tables.
create or replace function public.is_active_payment_target(
  _merchant_id uuid,
  _branch_id uuid,
  _device_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.merchants m
    where m.id = _merchant_id
      and m.is_active = true
      and (
        _branch_id is null
        or exists (
          select 1
          from public.branches b
          where b.id = _branch_id
            and b.merchant_id = m.id
            and b.is_active = true
        )
      )
      and (
        _device_id is null
        or exists (
          select 1
          from public.devices d
          where d.id = _device_id
            and d.merchant_id = m.id
            and d.status = 'active'
            and d.revoked_at is null
            and d.branch_id is not distinct from _branch_id
        )
      )
  );
$function$;

revoke all on function public.is_active_payment_target(uuid, uuid, uuid) from public;
grant execute on function public.is_active_payment_target(uuid, uuid, uuid) to anon, authenticated;

drop policy if exists "Public can create initiated payment sessions" on public.payment_sessions;

create policy "Public can create initiated payment sessions"
on public.payment_sessions
for insert
to anon, authenticated
with check (
  status = 'initiated'
  and source = 'tap2pay'
  and confirmed_at is null
  and confirmed_by is null
  and amount > 0
  and amount <= 100000
  and exists (
    select 1
    from public.merchants m
    join public.merchant_payment_methods pm on pm.merchant_id = m.id
    where m.id = payment_sessions.merchant_id
      and m.is_active = true
      and pm.id = payment_sessions.payment_method_id
      and pm.is_active = true
      and pm.provider = payment_sessions.provider
  )
  and public.is_active_payment_target(
    payment_sessions.merchant_id,
    payment_sessions.branch_id,
    payment_sessions.device_id
  )
);
