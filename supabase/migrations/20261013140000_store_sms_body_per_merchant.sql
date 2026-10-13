-- Store full SMS bodies only for financial messages accepted by the paired reader.
-- Merchant ownership is derived from the reader secret on the server, never from client input.
alter table public.financial_transactions
  add column if not exists sms_body text;

alter table public.financial_transactions
  add constraint financial_transactions_sms_body_length_check
  check (sms_body is null or pg_catalog.length(sms_body) <= 5000);

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
  if _device_secret_hash is null or _device_secret_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Reader authentication failed';
  end if;
  if _events is null or pg_catalog.jsonb_typeof(_events) <> 'array' then
    raise exception 'Events must be a JSON array';
  end if;
  v_event_count := pg_catalog.jsonb_array_length(_events);
  if v_event_count < 1 or v_event_count > 100 then
    raise exception 'A sync batch must contain between 1 and 100 events';
  end if;
  if _app_version is not null and pg_catalog.length(_app_version) > 40 then
    raise exception 'App version is too long';
  end if;

  select r.* into v_reader
  from private.sms_reader_pairing_secrets s
  join public.sms_readers r on r.id = s.reader_id
  where s.device_secret_hash = _device_secret_hash
    and s.consumed_at is not null
    and r.status = 'paired'
    and r.revoked_at is null
  for update of s;
  if not found then
    raise exception 'Reader authentication failed or reader was revoked';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(_events) as e(value)
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
       or (nullif(e.value->>'sms_body', '') is not null and pg_catalog.length(e.value->>'sms_body') > 5000)
       or coalesce(e.value->>'occurred_at', '') !~ '^\d{4}-\d{2}-\d{2}T'
  ) then
    raise exception 'Sync batch has an invalid financial event';
  end if;

  insert into public.financial_transactions (
    merchant_id, branch_id, sms_reader_id, direction, provider, amount, currency,
    counterparty, counterparty_name, tx_id, occurred_at, source,
    verification_state, review_state, dedupe_key, message_excerpt, sms_body
  )
  select
    v_reader.merchant_id, v_reader.branch_id, v_reader.id,
    e.value->>'direction', e.value->>'provider', (e.value->>'amount')::numeric,
    coalesce(e.value->>'currency', 'USD'), nullif(e.value->>'counterparty', ''),
    nullif(e.value->>'counterparty_name', ''), nullif(e.value->>'tx_id', ''),
    (e.value->>'occurred_at')::timestamptz, 'sms_reader', 'unverified', 'needs_review',
    e.value->>'dedupe_key', null, nullif(e.value->>'sms_body', '')
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
