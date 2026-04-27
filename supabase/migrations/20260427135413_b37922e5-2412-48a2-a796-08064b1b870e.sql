CREATE TABLE public.company_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  protocol_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  responsible TEXT,
  obs TEXT,
  file_url TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view company documents"
ON public.company_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert company documents"
ON public.company_documents FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update company documents"
ON public.company_documents FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete company documents"
ON public.company_documents FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_company_documents_updated_at
BEFORE UPDATE ON public.company_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('company-documents', 'company-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can view company doc files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'company-documents');

CREATE POLICY "Admin can upload company doc files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company-documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete company doc files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'company-documents' AND has_role(auth.uid(), 'admin'::app_role));