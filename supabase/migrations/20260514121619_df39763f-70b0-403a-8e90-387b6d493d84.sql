-- ============ stock_items ============
CREATE TABLE public.stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_type text NOT NULL UNIQUE,
  current_quantity_kg numeric NOT NULL DEFAULT 0,
  price_per_kg numeric NOT NULL DEFAULT 0,
  carreta_target_kg numeric NOT NULL DEFAULT 27000,
  last_entry_at timestamptz,
  last_exit_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view stock_items" ON public.stock_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/financeiro insert stock_items" ON public.stock_items
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
CREATE POLICY "Admin/financeiro update stock_items" ON public.stock_items
  FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
CREATE POLICY "Admin delete stock_items" ON public.stock_items
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_stock_items_updated BEFORE UPDATE ON public.stock_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ stock_movements ============
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_type text NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('entrada','saida','ajuste')),
  quantity_kg numeric NOT NULL,
  origin_type text CHECK (origin_type IN ('ticket','manual','ajuste')),
  origin_id text,
  destination text,
  responsible_id uuid,
  observation text,
  invoice_number text,
  adjustment_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_movements_material ON public.stock_movements(material_type);
CREATE INDEX idx_stock_movements_created ON public.stock_movements(created_at DESC);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view stock_movements" ON public.stock_movements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert stock_movements" ON public.stock_movements
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role) OR has_role(auth.uid(),'operador_balanca'::app_role));
CREATE POLICY "Admin update stock_movements" ON public.stock_movements
  FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admin delete stock_movements" ON public.stock_movements
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

-- ============ Pre-populate materials ============
INSERT INTO public.stock_items (material_type, current_quantity_kg, price_per_kg, carreta_target_kg) VALUES
  ('mista', 0, 0, 27000),
  ('pesada', 0, 0, 27000),
  ('limaria', 0, 0, 27000),
  ('fundido', 0, 0, 27000),
  ('amortecedor', 0, 0, 27000),
  ('aluminio', 0, 0, 24000),
  ('cobre', 0, 0, 22000),
  ('bronze', 0, 0, 22000),
  ('inox', 0, 0, 24000),
  ('outros', 0, 0, 27000);

-- Sync prices from material_prices if any exist
UPDATE public.stock_items s
SET price_per_kg = mp.price_per_kg
FROM public.material_prices mp
WHERE s.material_type = mp.material_type;

-- ============ Function to apply movements to stock_items ============
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure stock_item row exists
  INSERT INTO public.stock_items (material_type, current_quantity_kg)
  VALUES (NEW.material_type, 0)
  ON CONFLICT (material_type) DO NOTHING;

  IF NEW.movement_type = 'entrada' THEN
    UPDATE public.stock_items
    SET current_quantity_kg = current_quantity_kg + NEW.quantity_kg,
        last_entry_at = NEW.created_at,
        updated_at = now()
    WHERE material_type = NEW.material_type;
  ELSIF NEW.movement_type = 'saida' THEN
    UPDATE public.stock_items
    SET current_quantity_kg = GREATEST(0, current_quantity_kg - NEW.quantity_kg),
        last_exit_at = NEW.created_at,
        updated_at = now()
    WHERE material_type = NEW.material_type;
  ELSIF NEW.movement_type = 'ajuste' THEN
    UPDATE public.stock_items
    SET current_quantity_kg = GREATEST(0, current_quantity_kg + NEW.quantity_kg),
        updated_at = now()
    WHERE material_type = NEW.material_type;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_stock_movement
AFTER INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

-- ============ Auto entry from weighing_fractions ============
CREATE OR REPLACE FUNCTION public.auto_entry_from_fraction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket int;
BEGIN
  IF NEW.material_type IS NULL OR NEW.final_weight IS NULL OR NEW.final_weight <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT ticket_number INTO v_ticket FROM public.weighings WHERE id = NEW.weighing_id;

  INSERT INTO public.stock_movements (
    material_type, movement_type, quantity_kg, origin_type, origin_id,
    observation, created_by
  ) VALUES (
    NEW.material_type, 'entrada', NEW.final_weight, 'ticket', COALESCE(v_ticket::text, NEW.weighing_id::text),
    'Entrada automática via balança (fração #' || NEW.sequence_number || ')',
    NEW.created_by
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_entry_fraction
AFTER INSERT ON public.weighing_fractions
FOR EACH ROW EXECUTE FUNCTION public.auto_entry_from_fraction();
