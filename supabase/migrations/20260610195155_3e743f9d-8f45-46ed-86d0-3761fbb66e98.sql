
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.can_access_chat_channel(uuid, text) FROM authenticated;

-- Keep weighing-photos bucket public for direct URL access, but drop the
-- broad SELECT policy that allows clients to list bucket contents.
DROP POLICY IF EXISTS "Public read weighing photos" ON storage.objects;
