
-- 1. material_prices table
CREATE TABLE IF NOT EXISTS public.material_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_type text NOT NULL UNIQUE,
  price_per_kg numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.material_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view material prices"
  ON public.material_prices FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'financeiro'::app_role) OR
    has_role(auth.uid(), 'operador_balanca'::app_role) OR
    has_role(auth.uid(), 'conferente'::app_role)
  );

CREATE POLICY "Admin/financeiro can insert material prices"
  ON public.material_prices FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'financeiro'::app_role)
  );

CREATE POLICY "Admin/financeiro can update material prices"
  ON public.material_prices FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'financeiro'::app_role)
  );

CREATE TRIGGER update_material_prices_updated_at
  BEFORE UPDATE ON public.material_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default material prices
INSERT INTO public.material_prices (material_type, price_per_kg) VALUES
  ('mista', 1.20),
  ('pesada', 1.50),
  ('limaria', 0.80),
  ('fundido', 1.10),
  ('amortecedor', 0.90)
ON CONFLICT (material_type) DO NOTHING;

-- 2. Add fields to weighings
ALTER TABLE public.weighings
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_net_weight numeric,
  ADD COLUMN IF NOT EXISTS photo_url text;

-- 3. Add fields to client_transactions
ALTER TABLE public.client_transactions
  ADD COLUMN IF NOT EXISTS transaction_date timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS mista_kg numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pesada_kg numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS limaria_kg numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fundido_kg numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amortecedor_kg numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_kg numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_used numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ticket_number integer;

-- 4. Storage bucket for weighing photos
INSERT INTO storage.buckets (id, name, public)
  VALUES ('weighing-photos', 'weighing-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read weighing photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'weighing-photos');

CREATE POLICY "Operators can upload weighing photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'weighing-photos' AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'operador_balanca'::app_role) OR
      has_role(auth.uid(), 'financeiro'::app_role)
    )
  );

CREATE POLICY "Operators can update weighing photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'weighing-photos' AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'operador_balanca'::app_role) OR
      has_role(auth.uid(), 'financeiro'::app_role)
    )
  );
