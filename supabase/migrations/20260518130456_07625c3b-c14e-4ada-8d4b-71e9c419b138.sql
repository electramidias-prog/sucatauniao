-- Add QR code field to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS qr_code_url text;

-- Sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1000;

-- Invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number integer NOT NULL UNIQUE DEFAULT nextval('public.invoice_number_seq'),
  client_id uuid NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'rascunho',
  total_amount numeric NOT NULL DEFAULT 0,
  observations text,
  pdf_url text,
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  item_date date,
  service_type text NOT NULL,
  document_number text,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Invoices policies
CREATE POLICY "Authenticated view invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/financeiro insert invoices" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
CREATE POLICY "Admin/financeiro update invoices" ON public.invoices FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
CREATE POLICY "Admin delete invoices" ON public.invoices FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));

-- Invoice items policies
CREATE POLICY "Authenticated view invoice_items" ON public.invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/financeiro insert invoice_items" ON public.invoice_items FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
CREATE POLICY "Admin/financeiro update invoice_items" ON public.invoice_items FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
CREATE POLICY "Admin/financeiro delete invoice_items" ON public.invoice_items FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));

CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for invoices
INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated view invoice files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'invoices');
CREATE POLICY "Admin/financeiro upload invoice files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoices' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role)));
CREATE POLICY "Admin/financeiro update invoice files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'invoices' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role)));
CREATE POLICY "Public can read invoice files" ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'invoices');