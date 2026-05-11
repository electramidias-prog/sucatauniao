
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  cpf TEXT,
  rg TEXT,
  birth_date DATE,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  address TEXT,
  role_title TEXT,
  cbo_code TEXT,
  sector TEXT,
  admission_date DATE,
  contract_type TEXT,
  base_salary NUMERIC,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.employee_trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  nr_code TEXT NOT NULL,
  training_date DATE,
  expiry_date DATE,
  certificate_url TEXT,
  instructor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.employee_asos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  aso_type TEXT NOT NULL,
  aso_date DATE,
  expiry_date DATE,
  doctor_name TEXT,
  doctor_crm TEXT,
  document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_asos ENABLE ROW LEVEL SECURITY;

-- employees policies
CREATE POLICY "Authenticated can view employees" ON public.employees
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/financeiro can insert employees" ON public.employees
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
CREATE POLICY "Admin/financeiro can update employees" ON public.employees
  FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
CREATE POLICY "Admin can delete employees" ON public.employees
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

-- employee_trainings policies
CREATE POLICY "Authenticated can view trainings" ON public.employee_trainings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/financeiro can insert trainings" ON public.employee_trainings
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
CREATE POLICY "Admin/financeiro can update trainings" ON public.employee_trainings
  FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
CREATE POLICY "Admin can delete trainings" ON public.employee_trainings
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

-- employee_asos policies
CREATE POLICY "Authenticated can view asos" ON public.employee_asos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/financeiro can insert asos" ON public.employee_asos
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
CREATE POLICY "Admin/financeiro can update asos" ON public.employee_asos
  FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
CREATE POLICY "Admin can delete asos" ON public.employee_asos
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER set_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_employee_trainings_employee ON public.employee_trainings(employee_id);
CREATE INDEX idx_employee_asos_employee ON public.employee_asos(employee_id);
CREATE INDEX idx_employees_status ON public.employees(status);
