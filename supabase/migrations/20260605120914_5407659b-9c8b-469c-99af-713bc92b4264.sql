
-- Enable required extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============ paid_weighings ============
CREATE TABLE IF NOT EXISTS public.paid_weighings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('avulsa','cadastrada')),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  vehicle_plate text NOT NULL,
  operator_id uuid NOT NULL DEFAULT auth.uid(),
  gross_weight numeric(12,3),
  tare_weight numeric(12,3),
  net_weight numeric(12,3) GENERATED ALWAYS AS (COALESCE(gross_weight,0) - COALESCE(tare_weight,0)) STORED,
  entry_at timestamptz NOT NULL DEFAULT now(),
  exit_at timestamptz,
  status text NOT NULL DEFAULT 'em_aberto' CHECK (status IN ('em_aberto','finalizado','encerrado_automatico','reaberto')),
  payment_status text NOT NULL DEFAULT 'nao_pago' CHECK (payment_status IN ('pago','nao_pago')),
  payment_at timestamptz,
  price_per_kg numeric(12,4),
  total_amount numeric(14,2),
  notes text,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paid_weighings TO authenticated;
GRANT ALL ON public.paid_weighings TO service_role;
ALTER TABLE public.paid_weighings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "paid_weighings_select" ON public.paid_weighings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operador_balanca') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "paid_weighings_insert" ON public.paid_weighings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operador_balanca') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "paid_weighings_update" ON public.paid_weighings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operador_balanca') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "paid_weighings_delete" ON public.paid_weighings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS idx_paid_weighings_status ON public.paid_weighings(status);
CREATE INDEX IF NOT EXISTS idx_paid_weighings_type ON public.paid_weighings(type);
CREATE INDEX IF NOT EXISTS idx_paid_weighings_client ON public.paid_weighings(client_id);
CREATE INDEX IF NOT EXISTS idx_paid_weighings_entry_at ON public.paid_weighings(entry_at);

CREATE TRIGGER trg_paid_weighings_updated_at
BEFORE UPDATE ON public.paid_weighings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ paid_weighing_reopenings ============
CREATE TABLE IF NOT EXISTS public.paid_weighing_reopenings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paid_weighing_id uuid NOT NULL REFERENCES public.paid_weighings(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL DEFAULT auth.uid(),
  reason text NOT NULL CHECK (reason IN ('cliente_ligou','superior_liberou','tolerancia','outro')),
  reason_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.paid_weighing_reopenings TO authenticated;
GRANT ALL ON public.paid_weighing_reopenings TO service_role;
ALTER TABLE public.paid_weighing_reopenings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reopenings_select" ON public.paid_weighing_reopenings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operador_balanca') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "reopenings_insert" ON public.paid_weighing_reopenings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operador_balanca'));

-- ============ client_default_tares ============
CREATE TABLE IF NOT EXISTS public.client_default_tares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tare_weight numeric(12,3) NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_default_tares TO authenticated;
GRANT ALL ON public.client_default_tares TO service_role;
ALTER TABLE public.client_default_tares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tares_select" ON public.client_default_tares FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operador_balanca') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "tares_insert" ON public.client_default_tares FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operador_balanca') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "tares_update" ON public.client_default_tares FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operador_balanca') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "tares_delete" ON public.client_default_tares FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_client_default_tares_updated_at
BEFORE UPDATE ON public.client_default_tares
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ internal_weighings ============
CREATE TABLE IF NOT EXISTS public.internal_weighings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  vehicle_plate text NOT NULL,
  gross_weight numeric(12,3),
  tare_weight numeric(12,3),
  net_weight numeric(12,3) GENERATED ALWAYS AS (COALESCE(gross_weight,0) - COALESCE(tare_weight,0)) STORED,
  entry_at timestamptz NOT NULL DEFAULT now(),
  exit_at timestamptz,
  status text NOT NULL DEFAULT 'em_aberto' CHECK (status IN ('em_aberto','finalizado')),
  destination text,
  notes text,
  operator_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_weighings TO authenticated;
GRANT ALL ON public.internal_weighings TO service_role;
ALTER TABLE public.internal_weighings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_w_select" ON public.internal_weighings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operador_balanca') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'conferente') OR public.has_role(auth.uid(),'contador'));
CREATE POLICY "internal_w_insert" ON public.internal_weighings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operador_balanca') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'conferente'));
CREATE POLICY "internal_w_update" ON public.internal_weighings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operador_balanca') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'conferente'));
CREATE POLICY "internal_w_delete" ON public.internal_weighings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS idx_internal_weighings_status ON public.internal_weighings(status);
CREATE INDEX IF NOT EXISTS idx_internal_weighings_employee ON public.internal_weighings(employee_id);

CREATE TRIGGER trg_internal_weighings_updated_at
BEFORE UPDATE ON public.internal_weighings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Scheduled job: auto-close avulsa tickets > 24h ============
DO $$
BEGIN
  PERFORM cron.unschedule('encerrar_tickets_avulsos_expirados');
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

SELECT cron.schedule(
  'encerrar_tickets_avulsos_expirados',
  '*/15 * * * *',
  $cron$
    UPDATE public.paid_weighings
    SET status = 'encerrado_automatico', updated_at = now()
    WHERE type = 'avulsa'
      AND status = 'em_aberto'
      AND exit_at IS NULL
      AND entry_at < now() - INTERVAL '24 hours';
  $cron$
);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.paid_weighings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_weighings;
