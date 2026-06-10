
-- Helper: drop all policies on a table and recreate standard ones
-- Standard model:
--   SELECT: auth.uid() IS NOT NULL
--   INSERT: auth.uid() IS NOT NULL
--   UPDATE: auth.uid() IS NOT NULL
--   DELETE: has_role(auth.uid(), 'admin')

DO $$
DECLARE
  tbl text;
  pol record;
  std_tables text[] := ARRAY[
    'bills','checklist_records','checklist_signatures','checklist_templates',
    'client_default_tares','client_pix_keys','client_transactions',
    'company_documents','dds_attendance','dds_operation_mode','dds_sessions','dds_themes',
    'employee_asos','employee_trainings','employees',
    'epi_deliveries','epi_inflows','epis',
    'equipment','equipment_documents',
    'internal_weighings','invoice_items','invoices','maintenance_records',
    'paid_weighings','payment_settlements',
    'stock_items','stock_movements','system_settings',
    'weighing_fractions','weighings'
  ];
BEGIN
  FOREACH tbl IN ARRAY std_tables LOOP
    -- drop all existing policies for this table
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=tbl LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;

    EXECUTE format('CREATE POLICY "auth_select_%1$s" ON public.%1$I FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)', tbl);
    EXECUTE format('CREATE POLICY "auth_insert_%1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL)', tbl);
    EXECUTE format('CREATE POLICY "auth_update_%1$s" ON public.%1$I FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)', tbl);
    EXECUTE format('CREATE POLICY "admin_delete_%1$s" ON public.%1$I FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''admin''::app_role))', tbl);
  END LOOP;
END $$;

-- paid_weighing_reopenings: simplify (was admin/operador only)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='paid_weighing_reopenings' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.paid_weighing_reopenings', pol.policyname);
  END LOOP;
END $$;
CREATE POLICY "auth_select_paid_weighing_reopenings" ON public.paid_weighing_reopenings FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_paid_weighing_reopenings" ON public.paid_weighing_reopenings FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin_delete_paid_weighing_reopenings" ON public.paid_weighing_reopenings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- clients: preserve portal own-row policy
DROP POLICY IF EXISTS "Staff can view clients" ON public.clients;
DROP POLICY IF EXISTS "Staff can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Staff can update clients" ON public.clients;
DROP POLICY IF EXISTS "Admin can delete clients" ON public.clients;
-- (keep "Client can view own record")
CREATE POLICY "auth_select_clients" ON public.clients FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_clients" ON public.clients FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin_delete_clients" ON public.clients FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- material_prices: admin-only mutations, all authenticated can view
DROP POLICY IF EXISTS "Admin/financeiro can insert material prices" ON public.material_prices;
DROP POLICY IF EXISTS "Admin/financeiro can update material prices" ON public.material_prices;
DROP POLICY IF EXISTS "Staff can view material prices" ON public.material_prices;
DROP POLICY IF EXISTS "Admin can delete material prices" ON public.material_prices;
CREATE POLICY "auth_select_material_prices" ON public.material_prices FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_insert_material_prices" ON public.material_prices FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_material_prices" ON public.material_prices FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_material_prices" ON public.material_prices FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- profiles: allow any authenticated to view (for name lookups in lists/audit/etc.)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "auth_view_profiles" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_delete_profiles" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
-- keep existing: "Users can update own profile", "System can insert profiles"
