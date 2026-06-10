
CREATE TABLE IF NOT EXISTS public.transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin TEXT NOT NULL CHECK (origin IN ('ticket', 'manual')),
  weighing_id UUID REFERENCES public.weighings(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  beneficiary_name TEXT,
  beneficiary_cpf TEXT,
  beneficiary_address TEXT,
  amount NUMERIC(14,2) NOT NULL,
  original_amount NUMERIC(14,2) NOT NULL,
  adjustment_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  adjustment_reason TEXT,
  payment_method TEXT CHECK (payment_method IN ('pix', 'ted', 'dinheiro', 'outro')),
  payment_proof_url TEXT,
  payment_notes TEXT,
  paid_at TIMESTAMPTZ,
  paid_by UUID,
  status TEXT NOT NULL DEFAULT 'em_aberto' CHECK (status IN ('em_aberto', 'aprovado', 'pago')),
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  created_by UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transfers TO authenticated;
GRANT ALL ON public.transfers TO service_role;

ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfers_select_authenticated" ON public.transfers
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "transfers_insert_authenticated" ON public.transfers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "transfers_update_authenticated" ON public.transfers
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "transfers_delete_admin" ON public.transfers
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_transfers_updated_at
  BEFORE UPDATE ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS transfers_status_idx ON public.transfers(status);
CREATE INDEX IF NOT EXISTS transfers_client_idx ON public.transfers(client_id);
CREATE INDEX IF NOT EXISTS transfers_weighing_idx ON public.transfers(weighing_id);

-- Storage policies for transfer-proofs bucket (created via storage tool)
CREATE POLICY "transfer_proofs_select_auth" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'transfer-proofs');
CREATE POLICY "transfer_proofs_insert_auth" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'transfer-proofs');
CREATE POLICY "transfer_proofs_update_auth" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'transfer-proofs');
CREATE POLICY "transfer_proofs_delete_admin" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'transfer-proofs' AND public.has_role(auth.uid(), 'admin'));
