
-- Storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-attachments', 'chat-attachments', false, 20971520, 
  ARRAY['application/pdf','image/png','image/jpeg','image/jpg','text/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel']);

-- Storage RLS: authenticated users can upload
CREATE POLICY "Authenticated users can upload chat attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-attachments');

CREATE POLICY "Authenticated users can read chat attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-attachments');

-- =============================================
-- CLIENTS MODULE
-- =============================================

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trade_name text,
  document_type text NOT NULL DEFAULT 'cpf',
  document_number text NOT NULL UNIQUE,
  state_registration text,
  municipal_registration text,
  email text,
  phone text,
  whatsapp text,
  address_street text,
  address_number text,
  address_complement text,
  address_neighborhood text,
  address_city text,
  address_state text DEFAULT 'MG',
  address_zip text,
  bank_name text,
  bank_agency text,
  bank_account text,
  pix_key_type text,
  pix_key text,
  client_type text NOT NULL DEFAULT 'fornecedor',
  status text NOT NULL DEFAULT 'ativo',
  portal_user_id uuid,
  portal_access_enabled boolean NOT NULL DEFAULT false,
  notes text,
  tags text[],
  source text DEFAULT 'manual',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view clients" ON public.clients
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'financeiro') OR 
  public.has_role(auth.uid(), 'operador_balanca')
);

CREATE POLICY "Client can view own record" ON public.clients
FOR SELECT TO authenticated
USING (portal_user_id = auth.uid());

CREATE POLICY "Staff can insert clients" ON public.clients
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'financeiro') OR 
  public.has_role(auth.uid(), 'operador_balanca')
);

CREATE POLICY "Staff can update clients" ON public.clients
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'financeiro')
);

CREATE POLICY "Admin can delete clients" ON public.clients
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- CLIENT CHANGE REQUESTS
-- =============================================

CREATE TABLE public.client_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  status text NOT NULL DEFAULT 'pendente',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view change requests" ON public.client_change_requests
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'financeiro') OR
  requested_by = auth.uid()
);

CREATE POLICY "Users can insert change requests" ON public.client_change_requests
FOR INSERT TO authenticated
WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Admin can update change requests" ON public.client_change_requests
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
