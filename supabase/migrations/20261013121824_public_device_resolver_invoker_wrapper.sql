create or replace function private.resolve_public_device(_token text)
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
  select d.id, d.branch_id, m.merchant_id, d.device_type, d.label
  from public.devices d
  join public.merchants m on m.id = d.merchant_id
  left join public.branches b
    on b.id = d.branch_id and b.merchant_id = d.merchant_id
  where d.public_token = pg_catalog.btrim(_token)
    and pg_catalog.length(pg_catalog.btrim(_token)) between 16 and 128
    and d.status = 'active'
    and d.revoked_at is null
    and m.is_active = true
    and (d.branch_id is null or b.is_active = true)
  limit 1;
$function$;

revoke all on function private.resolve_public_device(text) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.resolve_public_device(text) to anon, authenticated;

drop function if exists public.resolve_public_device(text);

create function public.resolve_public_device(_token text)
returns table (
  device_id uuid,
  branch_id uuid,
  merchant_key text,
  device_type text,
  device_label text
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.resolve_public_device(_token);
$function$;

revoke all on function public.resolve_public_device(text) from public;
grant execute on function public.resolve_public_device(text) to anon, authenticated;
