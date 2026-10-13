create table if not exists private.sms_reader_pairing_secrets (
  reader_id uuid primary key references public.sms_readers(id) on delete cascade,
  pairing_code_hash text,
  pairing_expires_at timestamptz,
  device_secret_hash text,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint sms_reader_pairing_hash_format check (pairing_code_hash is null or pairing_code_hash ~ '^[0-9a-f]{64}$'),
  constraint sms_reader_device_hash_format check (device_secret_hash is null or device_secret_hash ~ '^[0-9a-f]{64}$')
);

alter table private.sms_reader_pairing_secrets enable row level security;

create unique index if not exists sms_reader_pairing_code_hash_uq
  on private.sms_reader_pairing_secrets(pairing_code_hash)
  where pairing_code_hash is not null;

create unique index if not exists sms_reader_device_secret_hash_uq
  on private.sms_reader_pairing_secrets(device_secret_hash)
  where device_secret_hash is not null;

create or replace function public.register_sms_reader_pairing(
  _requested_by uuid,
  _merchant_id uuid,
  _branch_id uuid,
  _label text,
  _pairing_code_hash text,
  _expires_at timestamptz
)
returns table (reader_id uuid, reader_label text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_reader_id uuid;
  v_label text := pg_catalog.btrim(coalesce(_label, ''));
  v_is_platform_admin boolean;
  v_is_merchant_manager boolean;
begin
  if _requested_by is null or _merchant_id is null then raise exception 'Invalid pairing request'; end if;
  if pg_catalog.length(v_label) < 2 or pg_catalog.length(v_label) > 100 then raise exception 'Reader label must be between 2 and 100 characters'; end if;
  if _pairing_code_hash is null or _pairing_code_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid pairing code hash'; end if;
  if _expires_at <= pg_catalog.now() or _expires_at > pg_catalog.now() + interval '15 minutes' then raise exception 'Pairing expiry is invalid'; end if;

  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = _requested_by and ur.role = 'admin'::public.app_role
  ) into v_is_platform_admin;

  select exists (
    select 1 from public.merchant_memberships mm
    where mm.user_id = _requested_by
      and mm.merchant_id = _merchant_id
      and mm.status = 'active'
      and mm.role in ('owner', 'admin')
      and (
        (_branch_id is null and mm.branch_id is null)
        or (_branch_id is not null and (mm.branch_id is null or mm.branch_id = _branch_id))
      )
  ) into v_is_merchant_manager;

  if not (v_is_platform_admin or v_is_merchant_manager) then raise exception 'Not authorized to pair a reader for this merchant'; end if;
  if not exists (select 1 from public.merchants m where m.id = _merchant_id and m.is_active = true) then raise exception 'Merchant is not active'; end if;
  if _branch_id is not null and not exists (
    select 1 from public.branches b where b.id = _branch_id and b.merchant_id = _merchant_id and b.is_active = true
  ) then raise exception 'Branch does not belong to this active merchant'; end if;

  insert into public.sms_readers (merchant_id, branch_id, label, status, paired_at, revoked_at, updated_at)
  values (_merchant_id, _branch_id, v_label, 'pending', null, null, pg_catalog.now())
  returning id into v_reader_id;

  insert into private.sms_reader_pairing_secrets (reader_id, pairing_code_hash, pairing_expires_at, device_secret_hash)
  values (v_reader_id, _pairing_code_hash, _expires_at, null);

  return query select v_reader_id, v_label, _expires_at;
end;
$function$;

revoke all on function public.register_sms_reader_pairing(uuid, uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.register_sms_reader_pairing(uuid, uuid, uuid, text, text, timestamptz) to service_role;

create or replace function public.complete_sms_reader_pairing(
  _pairing_code_hash text, _device_secret_hash text, _app_version text, _sim_last4 text
)
returns table (reader_id uuid, merchant_id uuid, branch_id uuid, reader_label text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_reader public.sms_readers%rowtype;
  v_secret private.sms_reader_pairing_secrets%rowtype;
begin
  if _pairing_code_hash is null or _pairing_code_hash !~ '^[0-9a-f]{64}$'
     or _device_secret_hash is null or _device_secret_hash !~ '^[0-9a-f]{64}$' then raise exception 'Pairing credentials are invalid'; end if;
  if _sim_last4 is not null and _sim_last4 !~ '^[0-9]{4}$' then raise exception 'SIM last-four value is invalid'; end if;
  if _app_version is not null and pg_catalog.length(_app_version) > 40 then raise exception 'App version is too long'; end if;

  select s.* into v_secret
  from private.sms_reader_pairing_secrets s
  where s.pairing_code_hash = _pairing_code_hash
    and s.pairing_expires_at > pg_catalog.now()
    and s.consumed_at is null
    and s.device_secret_hash is null
  for update;
  if not found then raise exception 'Pairing code is invalid, expired, or already used'; end if;

  select r.* into v_reader
  from public.sms_readers r
  where r.id = v_secret.reader_id and r.status = 'pending' and r.revoked_at is null
  for update;
  if not found then raise exception 'Reader is no longer available for pairing'; end if;

  update private.sms_reader_pairing_secrets
  set pairing_code_hash = null, pairing_expires_at = null, consumed_at = pg_catalog.now(), device_secret_hash = _device_secret_hash
  where reader_id = v_secret.reader_id;

  update public.sms_readers
  set status = 'paired', paired_at = pg_catalog.now(), last_sync_at = null,
      app_version = nullif(pg_catalog.btrim(coalesce(_app_version, '')), ''),
      sim_last4 = _sim_last4, updated_at = pg_catalog.now()
  where id = v_reader.id;

  return query select v_reader.id, v_reader.merchant_id, v_reader.branch_id, v_reader.label;
end;
$function$;

revoke all on function public.complete_sms_reader_pairing(text, text, text, text) from public, anon, authenticated;
grant execute on function public.complete_sms_reader_pairing(text, text, text, text) to service_role;

create or replace function public.ingest_sms_reader_batch(
  _device_secret_hash text, _app_version text, _events jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_reader public.sms_readers%rowtype;
  v_inserted integer := 0;
  v_event_count integer;
begin
  if _device_secret_hash is null or _device_secret_hash !~ '^[0-9a-f]{64}$' then raise exception 'Reader authentication failed'; end if;
  if _events is null or pg_catalog.jsonb_typeof(_events) <> 'array' then raise exception 'Events must be a JSON array'; end if;
  v_event_count := pg_catalog.jsonb_array_length(_events);
  if v_event_count < 1 or v_event_count > 100 then raise exception 'A sync batch must contain between 1 and 100 events'; end if;
  if _app_version is not null and pg_catalog.length(_app_version) > 40 then raise exception 'App version is too long'; end if;

  select r.* into v_reader
  from private.sms_reader_pairing_secrets s
  join public.sms_readers r on r.id = s.reader_id
  where s.device_secret_hash = _device_secret_hash and s.consumed_at is not null
    and r.status = 'paired' and r.revoked_at is null
  for update of s;
  if not found then raise exception 'Reader authentication failed or reader was revoked'; end if;

  if exists (
    select 1 from pg_catalog.jsonb_array_elements(_events) as e(value)
    where pg_catalog.jsonb_typeof(e.value) <> 'object'
       or coalesce(e.value->>'direction', '') not in ('incoming', 'outgoing')
       or coalesce(e.value->>'provider', '') not in ('evc', 'edahab', 'premier')
       or coalesce(e.value->>'currency', 'USD') not in ('USD', 'SOS')
       or coalesce(e.value->>'amount', '') !~ '^[0-9]{1,6}(\.[0-9]{1,2})?$'
       or (e.value->>'amount')::numeric <= 0
       or (e.value->>'amount')::numeric > 100000
       or coalesce(e.value->>'dedupe_key', '') !~ '^[A-Fa-f0-9:_-]{16,128}$'
       or (nullif(e.value->>'tx_id', '') is not null and (e.value->>'tx_id') !~ '^[A-Za-z0-9_-]{1,100}$')
       or (nullif(e.value->>'counterparty', '') is not null and (e.value->>'counterparty') !~ '^\+?[0-9*# -]{6,24}$')
       or (nullif(e.value->>'counterparty_name', '') is not null and pg_catalog.length(e.value->>'counterparty_name') > 120)
       or coalesce(e.value->>'occurred_at', '') !~ '^\d{4}-\d{2}-\d{2}T'
  ) then raise exception 'Sync batch has an invalid financial event'; end if;

  insert into public.financial_transactions (
    merchant_id, branch_id, sms_reader_id, direction, provider, amount, currency,
    counterparty, counterparty_name, tx_id, occurred_at, source,
    verification_state, review_state, dedupe_key, message_excerpt
  )
  select
    v_reader.merchant_id, v_reader.branch_id, v_reader.id,
    e.value->>'direction', e.value->>'provider', (e.value->>'amount')::numeric,
    coalesce(e.value->>'currency', 'USD'), nullif(e.value->>'counterparty', ''),
    nullif(e.value->>'counterparty_name', ''), nullif(e.value->>'tx_id', ''),
    (e.value->>'occurred_at')::timestamptz, 'sms_reader', 'unverified', 'needs_review',
    e.value->>'dedupe_key', null
  from pg_catalog.jsonb_array_elements(_events) as e(value)
  on conflict do nothing;

  get diagnostics v_inserted = row_count;

  update public.sms_readers
  set last_sync_at = pg_catalog.now(),
      app_version = coalesce(nullif(pg_catalog.btrim(coalesce(_app_version, '')), ''), app_version),
      updated_at = pg_catalog.now()
  where id = v_reader.id;

  return v_inserted;
end;
$function$;

revoke all on function public.ingest_sms_reader_batch(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_sms_reader_batch(text, text, jsonb) to service_role;
