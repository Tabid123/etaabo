CREATE TABLE public.merchant_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (char_length(comment) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.merchant_feedback TO anon;
GRANT INSERT, SELECT ON public.merchant_feedback TO authenticated;
GRANT ALL ON public.merchant_feedback TO service_role;
ALTER TABLE public.merchant_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can rate active merchants" ON public.merchant_feedback FOR INSERT TO anon, authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.merchants WHERE id = public.merchant_feedback.merchant_id AND is_active = true));
CREATE POLICY "Admins can view feedback" ON public.merchant_feedback FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_merchant_feedback_updated_at BEFORE UPDATE ON public.merchant_feedback FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();