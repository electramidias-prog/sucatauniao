
-- Equipment table
CREATE TABLE public.equipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  year INTEGER,
  plate TEXT,
  serial_number TEXT,
  patrimony TEXT,
  sector TEXT,
  responsible_id UUID,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  nr12_date DATE,
  nr12_expiry DATE,
  nr12_technician TEXT,
  nr12_art TEXT,
  nr12_pdf_url TEXT,
  inmetro_date DATE,
  inmetro_expiry DATE,
  inmetro_cert TEXT,
  inmetro_pdf_url TEXT,
  maintenance_frequency TEXT,
  next_maintenance DATE,
  last_checklist_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.equipment_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL,
  name TEXT NOT NULL,
  expiry_date DATE,
  document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.checklist_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  equipment_types TEXT[] NOT NULL DEFAULT '{}',
  items JSONB NOT NULL DEFAULT '[]',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.checklist_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL,
  equipment_id UUID,
  employee_id UUID,
  record_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  supervisor_id UUID,
  responses JSONB NOT NULL DEFAULT '{}',
  observations TEXT,
  result TEXT NOT NULL DEFAULT 'pendente',
  pdf_url TEXT,
  photo_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.checklist_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id UUID NOT NULL,
  person_name TEXT NOT NULL,
  role TEXT,
  signature_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.maintenance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'preventiva',
  description TEXT,
  responsible_id UUID,
  cost NUMERIC DEFAULT 0,
  parts_replaced TEXT,
  maintenance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  next_maintenance DATE,
  attachments TEXT[],
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;

-- Equipment RLS
CREATE POLICY "Authenticated view equipment" ON public.equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/financeiro insert equipment" ON public.equipment FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
CREATE POLICY "Admin/financeiro update equipment" ON public.equipment FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
CREATE POLICY "Admin delete equipment" ON public.equipment FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Authenticated view eq_docs" ON public.equipment_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/financeiro insert eq_docs" ON public.equipment_documents FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
CREATE POLICY "Admin/financeiro update eq_docs" ON public.equipment_documents FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
CREATE POLICY "Admin delete eq_docs" ON public.equipment_documents FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Authenticated view templates" ON public.checklist_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/financeiro insert templates" ON public.checklist_templates FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
CREATE POLICY "Admin/financeiro update templates" ON public.checklist_templates FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
CREATE POLICY "Admin delete templates" ON public.checklist_templates FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Authenticated view records" ON public.checklist_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert records" ON public.checklist_records FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admin/financeiro update records" ON public.checklist_records FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
CREATE POLICY "Admin delete records" ON public.checklist_records FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Authenticated view signatures" ON public.checklist_signatures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert signatures" ON public.checklist_signatures FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admin delete signatures" ON public.checklist_signatures FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Authenticated view maintenance" ON public.maintenance_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/financeiro insert maintenance" ON public.maintenance_records FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
CREATE POLICY "Admin/financeiro update maintenance" ON public.maintenance_records FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
CREATE POLICY "Admin delete maintenance" ON public.maintenance_records FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_equipment_updated_at BEFORE UPDATE ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('equipment-files','equipment-files', false) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Auth view equipment files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'equipment-files');
CREATE POLICY "Auth upload equipment files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'equipment-files');
CREATE POLICY "Auth update equipment files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'equipment-files');
CREATE POLICY "Admin delete equipment files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'equipment-files' AND has_role(auth.uid(),'admin'::app_role));

-- Pre-populate 5 default checklist templates
INSERT INTO public.checklist_templates (name, equipment_types, items) VALUES
('Check-List Veículo', ARRAY['Caminhão','Carreta'], '[
  {"text":"Conferência do nível de água do veículo","type":"SN"},
  {"text":"Conferência do pneu","type":"SN"},
  {"text":"Conferência do nível de óleo de motor","type":"SN"},
  {"text":"O veículo em seu aspecto geral se encontra apto ao trabalho","type":"SN"},
  {"text":"Outros","type":"text"}
]'::jsonb),
('Check-List Tesoura Jacaré', ARRAY['Tesoura Jacaré'], '[
  {"text":"Conferência do nível de água da máquina","type":"SN"},
  {"text":"Conferência do nível de óleo hidráulico","type":"SN"},
  {"text":"Conferência do nível de óleo da lâmina de corte","type":"SN"},
  {"text":"A máquina em seu aspecto geral se encontra apta ao trabalho","type":"SN"},
  {"text":"Outros","type":"text"}
]'::jsonb),
('Check-List Garra Sucateira', ARRAY['Garra Sucateira'], '[
  {"text":"Conferência do nível de água da máquina","type":"SN"},
  {"text":"Conferência do nível de óleo hidráulico","type":"SN"},
  {"text":"Conferência do nível de óleo de motor","type":"SN"},
  {"text":"A máquina em seu aspecto geral se encontra apta ao trabalho","type":"SN"},
  {"text":"Outros","type":"text"}
]'::jsonb),
('Check-List Colaboradores Operações Manuais', ARRAY['Funcionário'], '[
  {"text":"Calçado de Segurança","type":"SN"},
  {"text":"Capacete","type":"SN"},
  {"text":"Protetor Auricular","type":"SN"},
  {"text":"Óculos de Segurança","type":"SN"},
  {"text":"Luva de raspa cano longo","type":"SN"}
]'::jsonb),
('ART/APR - Análise de Risco da Atividade', ARRAY['Funcionário','Caminhão','Carreta','Empilhadeira','Garra Sucateira','Tesoura Jacaré','Prensa','Cisalha'], '[
  {"text":"Avaliação ergonômica da atividade","type":"SNNA","section":"Ergonomia"},
  {"text":"Manuseio de produto químico","type":"SNNA","section":"Produto Químico"},
  {"text":"Bloqueio e isolamento de fontes de energia","type":"SNNA","section":"Controle de Fontes de Energia"},
  {"text":"Ferramentas adequadas e em bom estado","type":"SNNA","section":"Ferramentas"},
  {"text":"Máquinas e equipamentos com proteção","type":"SNNA","section":"Máquinas e Equipamentos"},
  {"text":"Carga suspensa sinalizada e isolada","type":"SNNA","section":"Carga Suspensa"},
  {"text":"Local organizado conforme 5S","type":"SNNA","section":"5S"},
  {"text":"Destinação correta de resíduos","type":"SNNA","section":"Geração de Resíduos"},
  {"text":"EPIs específicos da atividade","type":"SNNA","section":"EPIs Específicos"}
]'::jsonb);
