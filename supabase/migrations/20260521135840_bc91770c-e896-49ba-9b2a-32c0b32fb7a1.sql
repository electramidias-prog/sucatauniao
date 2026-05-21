
-- chat_messages
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('geral','balanca','financeiro','patio')),
  user_id uuid NOT NULL,
  content text,
  attachment_url text,
  attachment_type text CHECK (attachment_type IN ('image','document')),
  attachment_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_channel_created ON public.chat_messages(channel, created_at DESC);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Helper function for channel access
CREATE OR REPLACE FUNCTION public.can_access_chat_channel(_user_id uuid, _channel text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE _channel
    WHEN 'geral' THEN true
    WHEN 'balanca' THEN public.has_role(_user_id,'admin') OR public.has_role(_user_id,'operador_balanca')
    WHEN 'financeiro' THEN public.has_role(_user_id,'admin') OR public.has_role(_user_id,'financeiro')
    WHEN 'patio' THEN public.has_role(_user_id,'admin') OR public.has_role(_user_id,'conferente')
    ELSE false
  END
$$;

CREATE POLICY "View messages in allowed channels"
ON public.chat_messages FOR SELECT TO authenticated
USING (public.can_access_chat_channel(auth.uid(), channel));

CREATE POLICY "Send messages in allowed channels"
ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.can_access_chat_channel(auth.uid(), channel));

CREATE POLICY "Admin delete messages"
ON public.chat_messages FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));

-- chat_reads
CREATE TABLE public.chat_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('geral','balanca','financeiro','patio')),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, channel)
);

ALTER TABLE public.chat_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own reads"
ON public.chat_reads FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Insert own reads"
ON public.chat_reads FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own reads"
ON public.chat_reads FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reads;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

-- Storage policies for chat-attachments bucket (already exists)
CREATE POLICY "Authenticated read chat attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-attachments');

CREATE POLICY "Authenticated upload chat attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[2]);
