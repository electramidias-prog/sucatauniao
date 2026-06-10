import { supabase } from '@/integrations/supabase/client';

export type TarifaOrigem = 'global' | 'customizada';
export interface TarifaPesagem { valor: number; origem: TarifaOrigem }

const TARIFA_PADRAO_FALLBACK = 50;

export async function getTarifaPesagem(clientId?: string | null): Promise<TarifaPesagem> {
  if (clientId) {
    const { data } = await supabase
      .from('clients')
      .select('tarifa_pesagem_customizada')
      .eq('id', clientId)
      .maybeSingle();
    const v = (data as any)?.tarifa_pesagem_customizada;
    if (v !== null && v !== undefined && Number(v) >= 0) {
      return { valor: Number(v), origem: 'customizada' };
    }
  }
  const { data: gs } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'tarifa_pesagem_paga')
    .maybeSingle();
  const raw = (gs as any)?.value;
  const num = typeof raw === 'number' ? raw : Number(raw);
  return { valor: Number.isFinite(num) && num >= 0 ? num : TARIFA_PADRAO_FALLBACK, origem: 'global' };
}

export async function setTarifaGlobal(valor: number): Promise<void> {
  const { error } = await supabase
    .from('system_settings')
    .upsert({ key: 'tarifa_pesagem_paga', value: valor as any } as any, { onConflict: 'key' });
  if (error) throw error;
}
