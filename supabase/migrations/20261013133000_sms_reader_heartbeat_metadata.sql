-- SMS Reader heartbeat and device metadata for merchant-owned eTaabo readers.
-- No raw SMS body is stored by this migration.
alter table public.sms_readers
  add column if not exists last_seen_at timestamptz,
  add column if not exists device_model text,
  add column if not exists device_manufacturer text,
  add column if not exists android_version text;

create index if not exists sms_readers_merchant_last_seen_idx
  on public.sms_readers (merchant_id, last_seen_at desc);

create or replace function public.ping_sms_reader(
  _device_secret_hash text,
  _app_version text,
  _device_model text,
  _device_manufacturer text,
  _android_version text,
  _sim_last4 text
)
returns table (
  reader_id uuid,
  last_seen_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_reader_id uuid;
  v_now timestamptz := pg_catalog.now();
begin
  if _device_secret_hash is null or _device_secret_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Reader authentication failed';
  end if;
  if _app_version is not null and pg_catalog.length(_app_version) > 40 then raise exception 'App version too long'; end if;
  if _device_model is not null and pg_catalog.length(_device_model) > 100 then raise exception 'Device model too long'; end if;
  if _device_manufacturer is not null and pg_catalog.length(_device_manufacturer) > 100 then raise exception 'Device manufacturer too long'; end if;
  if _android_version is not null and pg_catalog.length(_android_version) > 40 then raise exception 'Android version too long'; end if;
  if _sim_last4 is not null and _sim_last4 !~ '^[0-9]{4}$' then raise exception 'SIM last-four value invalid'; end if;

  select r.id into v_reader_id
  from private.sms_reader_pairing_secrets s
  join public.sms_readers r on r.id = s.reader_id
  where s.device_secret_hash = _device_secret_hash
    and s.consumed_at is not null
    and r.status = 'paired'
    and r.revoked_at is null
  for update of s;
  if not found then raise exception 'Reader authentication failed or reader revoked'; end if;

  update public.sms_readers
  set last_seen_at = v_now,
      app_version = coalesce(nullif(pg_catalog.btrim(coalesce(_app_version, '')), ''), app_version),
      device_model = coalesce(nullif(pg_catalog.btrim(coalesce(_device_model, '')), ''), device_model),
      device_manufacturer = coalesce(nullif(pg_catalog.btrim(coalesce(_device_manufacturer, '')), ''), device_manufacturer),
      android_version = coalesce(nullif(pg_catalog.btrim(coalesce(_android_version, '')), ''), android_version),
      sim_last4 = coalesce(_sim_last4, sim_last4),
      updated_at = v_now
  where id = v_reader_id;

  return query select v_reader_id, v_now;
end;
$function$;

revoke all on function public.ping_sms_reader(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ping_sms_reader(text, text, text, text, text, text) to service_role;
