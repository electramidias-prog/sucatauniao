-- EPIs catalog
CREATE TABLE public.epis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  ca_number TEXT,
  ca_expiry DATE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  min_quantity NUMERIC NOT NULL DEFAULT 0,
  supplier TEXT,
  unit_price NUMERIC DEFAULT 0,
  photo_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.epis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view epis" ON public.epis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/financeiro can insert epis" ON public.epis FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro'));
CREATE POLICY "Admin/financeiro can update epis" ON public.epis FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro'));
CREATE POLICY "Admin can delete epis" ON public.epis FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

CREATE TRIGGER update_epis_updated_at BEFORE UPDATE ON public.epis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inflows
CREATE TABLE public.epi_inflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epi_id UUID NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  invoice TEXT,
  supplier TEXT,
  total_cost NUMERIC DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.epi_inflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view inflows" ON public.epi_inflows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/financeiro can insert inflows" ON public.epi_inflows FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro'));
CREATE POLICY "Admin can delete inflows" ON public.epi_inflows FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

-- Deliveries
CREATE TABLE public.epi_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epi_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  reason TEXT NOT NULL DEFAULT 'reposicao',
  size TEXT,
  signature_url TEXT,
  observation TEXT,
  receipt_pdf_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.epi_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view deliveries" ON public.epi_deliveries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/financeiro can insert deliveries" ON public.epi_deliveries FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro'));
CREATE POLICY "Admin can delete deliveries" ON public.epi_deliveries FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

-- Stock triggers
CREATE OR REPLACE FUNCTION public.epi_apply_inflow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.epis SET quantity = quantity + NEW.quantity, updated_at = now() WHERE id = NEW.epi_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_epi_inflow_apply AFTER INSERT ON public.epi_inflows
FOR EACH ROW EXECUTE FUNCTION public.epi_apply_inflow();

CREATE OR REPLACE FUNCTION public.epi_apply_delivery()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.epis SET quantity = GREATEST(0, quantity - NEW.quantity), updated_at = now() WHERE id = NEW.epi_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_epi_delivery_apply AFTER INSERT ON public.epi_deliveries
FOR EACH ROW EXECUTE FUNCTION public.epi_apply_delivery();

-- Storage bucket for EPI files
INSERT INTO storage.buckets (id, name, public) VALUES ('epi-files', 'epi-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can view epi files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'epi-files');
CREATE POLICY "Authenticated can upload epi files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'epi-files');
CREATE POLICY "Authenticated can update epi files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'epi-files');
CREATE POLICY "Admin can delete epi files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'epi-files' AND has_role(auth.uid(),'admin'));