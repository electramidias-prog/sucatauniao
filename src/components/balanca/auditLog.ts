import { supabase } from '@/integrations/supabase/client';

export async function logAudit(opts: {
  table: string;
  recordId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'COBRANCA_GERADA' | 'WHATSAPP_SENT';
  oldValue?: unknown;
  newValue?: unknown;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('audit_logs').insert({
      table_name: opts.table,
      record_id: opts.recordId,
      action: opts.action,
      old_value: (opts.oldValue ?? null) as any,
      new_value: (opts.newValue ?? null) as any,
      user_id: user?.id ?? null,
    } as any);
  } catch (e) {
    console.warn('audit log failed', e);
  }
}