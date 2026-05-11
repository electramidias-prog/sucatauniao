
-- Make material_type nullable on weighings (will hold 'multiplo' or be null when fractionated)
ALTER TABLE public.weighings ALTER COLUMN material_type DROP NOT NULL;
ALTER TABLE public.weighings ALTER COLUMN material_type DROP DEFAULT;

-- Add total_weight column (sum of fraction final_weight)
ALTER TABLE public.weighings ADD COLUMN IF NOT EXISTS total_weight NUMERIC NOT NULL DEFAULT 0;

-- Create weighing_fractions table
CREATE TABLE IF NOT EXISTS public.weighing_fractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weighing_id UUID NOT NULL REFERENCES public.weighings(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  previous_weight NUMERIC NOT NULL DEFAULT 0,
  current_tare NUMERIC NOT NULL DEFAULT 0,
  net_weight NUMERIC NOT NULL DEFAULT 0,
  material_type TEXT NOT NULL,
  price_per_kg NUMERIC NOT NULL DEFAULT 0,
  discount_type TEXT,
  discount_value NUMERIC NOT NULL DEFAULT 0,
  final_weight NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  photo_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weighing_fractions_weighing ON public.weighing_fractions(weighing_id);

ALTER TABLE public.weighing_fractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view fractions" ON public.weighing_fractions
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(),'admin'::app_role) OR
    has_role(auth.uid(),'financeiro'::app_role) OR
    has_role(auth.uid(),'operador_balanca'::app_role) OR
    has_role(auth.uid(),'conferente'::app_role)
  );

CREATE POLICY "Operators can insert fractions" ON public.weighing_fractions
  FOR INSERT TO authenticated WITH CHECK (
    has_role(auth.uid(),'admin'::app_role) OR
    has_role(auth.uid(),'operador_balanca'::app_role)
  );

CREATE POLICY "Staff can update fractions" ON public.weighing_fractions
  FOR UPDATE TO authenticated USING (
    has_role(auth.uid(),'admin'::app_role) OR
    has_role(auth.uid(),'operador_balanca'::app_role) OR
    has_role(auth.uid(),'financeiro'::app_role)
  );

CREATE POLICY "Admin can delete fractions" ON public.weighing_fractions
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
