
INSERT INTO public.system_settings (key, value)
VALUES ('tarifa_pesagem_paga', to_jsonb(50.00))
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS tarifa_pesagem_customizada NUMERIC(10,2);

ALTER TABLE public.paid_weighings
  ADD COLUMN IF NOT EXISTS tarifa_aplicada NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS tarifa_origem TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'paid_weighings_tarifa_origem_check') THEN
    ALTER TABLE public.paid_weighings
      ADD CONSTRAINT paid_weighings_tarifa_origem_check
      CHECK (tarifa_origem IS NULL OR tarifa_origem IN ('global','customizada'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_tarifa_pesagem(_client_id uuid)
RETURNS TABLE(valor numeric, origem text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_custom numeric;
  v_global numeric;
  v_raw jsonb;
BEGIN
  IF _client_id IS NOT NULL THEN
    SELECT tarifa_pesagem_customizada INTO v_custom FROM public.clients WHERE id = _client_id;
    IF v_custom IS NOT NULL THEN
      valor := v_custom; origem := 'customizada'; RETURN NEXT; RETURN;
    END IF;
  END IF;

  SELECT value INTO v_raw FROM public.system_settings WHERE key = 'tarifa_pesagem_paga';
  IF v_raw IS NOT NULL THEN
    BEGIN
      v_global := (v_raw #>> '{}')::numeric;
    EXCEPTION WHEN OTHERS THEN v_global := NULL;
    END;
  END IF;

  valor := COALESCE(v_global, 50.00);
  origem := 'global';
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_tarifa_pesagem(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tarifa_pesagem(uuid) TO authenticated, service_role;

DO $$ BEGIN
  PERFORM cron.unschedule('encerrar_tickets_avulsos_expirados');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'encerrar_tickets_avulsos_expirados',
  '*/15 * * * *',
  $cron$
    UPDATE public.paid_weighings pw
    SET status = 'encerrado_automatico',
        tarifa_aplicada = COALESCE(pw.tarifa_aplicada, t.valor),
        tarifa_origem   = COALESCE(pw.tarifa_origem, t.origem),
        total_amount    = COALESCE(pw.total_amount, t.valor),
        updated_at = now()
    FROM LATERAL public.get_tarifa_pesagem(pw.client_id) t
    WHERE pw.type = 'avulsa'
      AND pw.status = 'em_aberto'
      AND pw.exit_at IS NULL
      AND pw.entry_at < now() - INTERVAL '24 hours';
  $cron$
);
