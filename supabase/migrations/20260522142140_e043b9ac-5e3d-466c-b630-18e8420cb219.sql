
-- Drop existing FK on clients.portal_user_id if it points elsewhere
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clients_portal_user_id_fkey'
  ) THEN
    ALTER TABLE public.clients DROP CONSTRAINT clients_portal_user_id_fkey;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.portal_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_portal_credentials_email ON public.portal_credentials(email);
CREATE INDEX IF NOT EXISTS idx_portal_credentials_client ON public.portal_credentials(client_id);

CREATE TABLE IF NOT EXISTS public.portal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  credential_id UUID REFERENCES public.portal_credentials(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '8 hours'),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_sessions_token ON public.portal_sessions(token);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_client ON public.portal_sessions(client_id);

CREATE TABLE IF NOT EXISTS public.portal_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  email TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_login_attempts_ip_time ON public.portal_login_attempts(ip_address, attempted_at);

ALTER TABLE public.clients
  ADD CONSTRAINT clients_portal_user_id_fkey
  FOREIGN KEY (portal_user_id) REFERENCES public.portal_credentials(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.portal_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/financeiro manage portal credentials"
  ON public.portal_credentials FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));

CREATE POLICY "Admin view portal sessions"
  ON public.portal_sessions FOR SELECT
  USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admin view login attempts"
  ON public.portal_login_attempts FOR SELECT
  USING (public.has_role(auth.uid(),'admin'));
