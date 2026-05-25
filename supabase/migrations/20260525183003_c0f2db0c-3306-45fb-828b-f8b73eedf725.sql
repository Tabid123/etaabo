ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS banner_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('merchant-banners', 'merchant-banners', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read merchant banners"
ON storage.objects FOR SELECT
USING (bucket_id = 'merchant-banners');

CREATE POLICY "Authenticated upload merchant banners"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'merchant-banners');

CREATE POLICY "Authenticated update merchant banners"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'merchant-banners');

CREATE POLICY "Authenticated delete merchant banners"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'merchant-banners');