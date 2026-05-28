ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS evc_logo_url text,
  ADD COLUMN IF NOT EXISTS edahab_logo_url text,
  ADD COLUMN IF NOT EXISTS premier_logo_url text;