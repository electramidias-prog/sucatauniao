
-- 1. Fix chat-attachments duplicate policies
DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read chat attachments" ON storage.objects;
-- Tighten read to UID folder for chat-attachments
DROP POLICY IF EXISTS "Authenticated read chat attachments" ON storage.objects;
CREATE POLICY "Authenticated read chat attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments' AND (auth.uid())::text = (storage.foldername(name))[2]);

-- 2. Remove anonymous read on invoices bucket
DROP POLICY IF EXISTS "Public can read invoice files" ON storage.objects;

-- 3. Revoke EXECUTE on SECURITY DEFINER functions from anon
REVOKE EXECUTE ON FUNCTION public.auto_entry_from_fraction() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_stock_movement() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.epi_apply_delivery() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.epi_apply_inflow() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_chat_channel(uuid, text) FROM anon, PUBLIC;

-- 4. Realtime channel authorization (deny anon, scope chat topics by role)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_can_use_realtime" ON realtime.messages;
CREATE POLICY "authenticated_can_use_realtime"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    CASE
      WHEN realtime.topic() LIKE 'chat:%' THEN
        public.can_access_chat_channel(auth.uid(), split_part(realtime.topic(), ':', 2))
      ELSE true
    END
  );
CREATE POLICY "authenticated_can_publish_realtime"
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (
    CASE
      WHEN realtime.topic() LIKE 'chat:%' THEN
        public.can_access_chat_channel(auth.uid(), split_part(realtime.topic(), ':', 2))
      ELSE true
    END
  );
