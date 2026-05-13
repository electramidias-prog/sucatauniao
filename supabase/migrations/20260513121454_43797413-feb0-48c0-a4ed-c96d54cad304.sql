
-- Themes library
CREATE TABLE public.dds_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  last_addressed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dds_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view dds themes" ON public.dds_themes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/financeiro can insert dds themes" ON public.dds_themes FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "Admin/financeiro can update dds themes" ON public.dds_themes FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "Admin can delete dds themes" ON public.dds_themes FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Sessions
CREATE TABLE public.dds_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date DATE NOT NULL,
  session_time TIME,
  frequency_type TEXT NOT NULL DEFAULT 'semanal',
  theme_id UUID REFERENCES public.dds_themes(id) ON DELETE SET NULL,
  theme_title TEXT NOT NULL,
  category TEXT,
  supervisor_id UUID,
  location TEXT,
  duration_minutes INTEGER DEFAULT 0,
  summary TEXT,
  attendance_photo_url TEXT,
  ata_pdf_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dds_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view dds sessions" ON public.dds_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/financeiro can insert dds sessions" ON public.dds_sessions FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "Admin/financeiro can update dds sessions" ON public.dds_sessions FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "Admin can delete dds sessions" ON public.dds_sessions FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Attendance
CREATE TABLE public.dds_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.dds_sessions(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL,
  present BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dds_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view dds attendance" ON public.dds_attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/financeiro can insert dds attendance" ON public.dds_attendance FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "Admin/financeiro can update dds attendance" ON public.dds_attendance FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "Admin can delete dds attendance" ON public.dds_attendance FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Operation mode log
CREATE TABLE public.dds_operation_mode (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL DEFAULT 'semanal',
  reason TEXT,
  description TEXT,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_end_date DATE,
  ended_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dds_operation_mode ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view dds mode" ON public.dds_operation_mode FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/financeiro can insert dds mode" ON public.dds_operation_mode FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "Admin/financeiro can update dds mode" ON public.dds_operation_mode FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "Admin can delete dds mode" ON public.dds_operation_mode FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes
CREATE INDEX idx_dds_sessions_date ON public.dds_sessions(session_date DESC);
CREATE INDEX idx_dds_attendance_session ON public.dds_attendance(session_id);
CREATE INDEX idx_dds_attendance_employee ON public.dds_attendance(employee_id);

-- Seed themes (30 across categories)
INSERT INTO public.dds_themes (title, category, description) VALUES
('Postura correta no levantamento de cargas', 'Ergonomia', 'Como dobrar joelhos e manter coluna reta'),
('Pausas e alongamento durante a jornada', 'Ergonomia', 'Pausas curtas a cada 50 minutos'),
('Postura no posto de trabalho administrativo', 'Ergonomia', 'Ajuste de cadeira, mesa e monitor'),
('Uso correto de luvas de proteção', 'EPI', 'Tipos de luvas conforme atividade'),
('Importância do capacete', 'EPI', 'Quando e como usar corretamente'),
('Botina com biqueira de aço', 'EPI', 'Cuidados, conservação e limpeza'),
('Óculos de proteção e protetor facial', 'EPI', 'Riscos visuais no pátio de sucata'),
('Operação segura de empilhadeira', 'Manuseio de máquinas', 'Pré-uso, sinalização e velocidade'),
('Bloqueio e etiquetagem (LOTO)', 'Manuseio de máquinas', 'Procedimento antes de manutenção'),
('Risco de prensa hidráulica', 'Manuseio de máquinas', 'Distância segura e proteções fixas'),
('Uso seguro do guincho e do munck', 'Manuseio de máquinas', 'Carga máxima e área de exclusão'),
('Cinto de segurança tipo paraquedista', 'Trabalho em altura', 'Inspeção e ancoragem correta'),
('Trabalho em escadas e plataformas', 'Trabalho em altura', 'NR-35 e regras básicas'),
('Procedimento de entrada em espaço confinado', 'Espaços confinados', 'NR-33 e medição de gases'),
('Permissão de Trabalho (PT)', 'Espaços confinados', 'Quando emitir e como preencher'),
('Lavagem das mãos e higiene', 'Higiene pessoal', 'Antes das refeições e após uso de EPI'),
('Cuidados com unhas, cabelos e barba', 'Higiene pessoal', 'Riscos de aprisionamento em máquinas'),
('Saúde mental e identificação de sinais', 'Saúde mental', 'Estresse, sono e produtividade'),
('Conversa aberta sobre assédio', 'Saúde mental', 'Canais de denúncia e apoio'),
('Uso de extintores: PQS, CO2 e água', 'Prevenção de incêndio', 'Classe de fogo e técnica de uso'),
('Plano de abandono e ponto de encontro', 'Prevenção de incêndio', 'Rotas e responsáveis'),
('Primeiros socorros básicos', 'Primeiros socorros', 'PCR, sangramento e queimaduras'),
('Acionamento do SAMU e brigada interna', 'Primeiros socorros', 'Como reportar ocorrências'),
('Manuseio seguro de óleo e graxa', 'Riscos químicos', 'EPI específico e armazenamento'),
('Riscos do contato com baterias e ácidos', 'Riscos químicos', 'Procedimento em caso de respingo'),
('FISPQ: como ler e onde encontrar', 'Riscos químicos', 'Identificação de produtos químicos'),
('Velocidade máxima no pátio', 'Trânsito interno', 'Limites e sinalização'),
('Cuidados com pedestres e empilhadeiras', 'Trânsito interno', 'Áreas de circulação'),
('Análise pós-incidente: lições aprendidas', 'Pós-incidente', 'Como evitar reincidência'),
('Comunicação de quase-acidentes', 'Outros', 'Importância do reporte preventivo');

-- Initial mode (semanal)
INSERT INTO public.dds_operation_mode (mode, reason, description) VALUES ('semanal', 'inicial', 'Modo padrão de operação');
