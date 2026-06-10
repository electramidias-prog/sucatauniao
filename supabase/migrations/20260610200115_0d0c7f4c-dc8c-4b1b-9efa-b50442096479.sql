DROP POLICY IF EXISTS "authenticated_can_use_realtime" ON realtime.messages;

CREATE POLICY "authenticated_can_use_realtime" ON realtime.messages
FOR SELECT TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'chat:%' THEN public.can_access_chat_channel(auth.uid(), split_part(realtime.topic(), ':', 2))
    WHEN realtime.topic() LIKE 'presence:%' THEN true
    ELSE false
  END
);