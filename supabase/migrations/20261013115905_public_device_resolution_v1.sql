-- Resolve an opaque device token without exposing the private devices table.
create or replace function public.resolve_public_device(_token text)
returns table (
  device_id uuid,
  branch_id uuid,
  merchant_key text,
  device_type text,
  device_label text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    d.id,
    d.branch_id,
    m.merchant_id,
    d.device_type,
    d.label
  from public.devices d
  join public.merchants m on m.id = d.merchant_id
  left join public.branches b
    on b.id = d.branch_id
   and b.merchant_id = d.merchant_id
  where d.public_token = pg_catalog.btrim(_token)
    and pg_catalog.length(pg_catalog.btrim(_token)) between 16 and 128
    and d.status = 'active'
    and d.revoked_at is null
    and m.is_active = true
    and (d.branch_id is null or b.is_active = true)
  limit 1;
$function$;

revoke all on function public.resolve_public_device(text) from public;
grant execute on function public.resolve_public_device(text) to anon, authenticated;

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
  and (
    payment_sessions.branch_id is null
    or exists (
      select 1
      from public.branches b
      where b.id = payment_sessions.branch_id
        and b.merchant_id = payment_sessions.merchant_id
        and b.is_active = true
    )
  )
  and (
    payment_sessions.device_id is null
    or exists (
      select 1
      from public.devices d
      where d.id = payment_sessions.device_id
        and d.merchant_id = payment_sessions.merchant_id
        and d.status = 'active'
        and d.revoked_at is null
        and d.branch_id is not distinct from payment_sessions.branch_id
    )
  )
);
