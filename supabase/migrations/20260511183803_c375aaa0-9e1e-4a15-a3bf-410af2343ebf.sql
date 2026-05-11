
INSERT INTO storage.buckets (id, name, public) VALUES ('employee-files', 'employee-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can view employee files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'employee-files');

CREATE POLICY "Admin/financeiro can upload employee files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'employee-files' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role)));

CREATE POLICY "Admin/financeiro can update employee files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'employee-files' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role)));

CREATE POLICY "Admin can delete employee files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'employee-files' AND has_role(auth.uid(),'admin'::app_role));
