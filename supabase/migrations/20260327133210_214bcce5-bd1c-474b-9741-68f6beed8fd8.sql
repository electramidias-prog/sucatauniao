
-- Add new fields to clients
ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS nickname text,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS vehicle_plate text,
  ADD COLUMN IF NOT EXISTS operational_status text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS negotiation_history text;

-- Client PIX keys (multiple per client)
CREATE TABLE public.client_pix_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  key_type text NOT NULL DEFAULT 'cpf',
  key_value text NOT NULL,
  bank_name text,
  holder_name text,
  is_favorite boolean NOT NULL DEFAULT false,
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_pix_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view pix keys" ON public.client_pix_keys
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'financeiro') OR has_role(auth.uid(), 'operador_balanca'));

CREATE POLICY "Staff can insert pix keys" ON public.client_pix_keys
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'financeiro'));

CREATE POLICY "Staff can update pix keys" ON public.client_pix_keys
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'financeiro'));

CREATE POLICY "Admin can delete pix keys" ON public.client_pix_keys
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Weighings (pesagens)
CREATE TABLE public.weighings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  ticket_number serial,
  vehicle_plate text,
  material_type text NOT NULL DEFAULT 'mista',
  gross_weight numeric(12,2) NOT NULL DEFAULT 0,
  tare_weight numeric(12,2) NOT NULL DEFAULT 0,
  net_weight numeric(12,2) GENERATED ALWAYS AS (gross_weight - tare_weight) STORED,
  price_per_kg numeric(10,4) NOT NULL DEFAULT 0,
  total_value numeric(14,2) GENERATED ALWAYS AS ((gross_weight - tare_weight) * price_per_kg) STORED,
  status text NOT NULL DEFAULT 'pendente',
  settlement_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.weighings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view weighings" ON public.weighings
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'financeiro') OR has_role(auth.uid(), 'operador_balanca') OR has_role(auth.uid(), 'conferente'));

CREATE POLICY "Operators can insert weighings" ON public.weighings
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador_balanca'));

CREATE POLICY "Staff can update weighings" ON public.weighings
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'financeiro') OR has_role(auth.uid(), 'operador_balanca'));

-- Client transactions (conta corrente - vales, debitos)
CREATE TABLE public.client_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  type text NOT NULL DEFAULT 'debito',
  description text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberto',
  settlement_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view transactions" ON public.client_transactions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'financeiro'));

CREATE POLICY "Staff can insert transactions" ON public.client_transactions
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'financeiro'));

CREATE POLICY "Staff can update transactions" ON public.client_transactions
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'financeiro'));

-- Payment settlements (acertos de pagamento)
CREATE TABLE public.payment_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  total_materials numeric(14,2) NOT NULL DEFAULT 0,
  total_deductions numeric(14,2) NOT NULL DEFAULT 0,
  net_amount numeric(14,2) NOT NULL DEFAULT 0,
  pix_key_id uuid REFERENCES public.client_pix_keys(id),
  pix_key_display text,
  holder_name text,
  status text NOT NULL DEFAULT 'confirmado',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view settlements" ON public.payment_settlements
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'financeiro'));

CREATE POLICY "Staff can insert settlements" ON public.payment_settlements
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'financeiro'));

-- Add FK from weighings and transactions to settlements
ALTER TABLE public.weighings 
  ADD CONSTRAINT weighings_settlement_id_fkey 
  FOREIGN KEY (settlement_id) REFERENCES public.payment_settlements(id);

ALTER TABLE public.client_transactions 
  ADD CONSTRAINT client_transactions_settlement_id_fkey 
  FOREIGN KEY (settlement_id) REFERENCES public.payment_settlements(id);

-- Trigger to update updated_at on weighings
CREATE TRIGGER update_weighings_updated_at
  BEFORE UPDATE ON public.weighings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for weighings
ALTER PUBLICATION supabase_realtime ADD TABLE public.weighings;
