DROP POLICY IF EXISTS "authenticated_can_publish_realtime" ON realtime.messages;

CREATE POLICY "authenticated_can_publish_realtime"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  CASE
    WHEN realtime.topic() LIKE 'chat:%' THEN public.can_access_chat_channel(auth.uid(), split_part(realtime.topic(), ':', 2))
    WHEN realtime.topic() LIKE 'presence:%' THEN true
    WHEN realtime.topic() LIKE 'chat-typing:%' THEN public.can_access_chat_channel(auth.uid(), split_part(realtime.topic(), ':', 2))
    WHEN realtime.topic() = 'online-users' THEN true
    ELSE false
  END
);