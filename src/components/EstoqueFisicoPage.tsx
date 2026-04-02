import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Warehouse, TrendingUp, TrendingDown, Package } from 'lucide-react';

const MATERIALS: Record<string, string> = {
  mista: 'Mista', pesada: 'Pesada', limaria: 'Limaria', fundido: 'Fundido',
  amortecedor: 'Amortecedor', ferro: 'Ferro', cobre: 'Cobre',
  aluminio: 'Alumínio', inox: 'Inox', outros: 'Outros',
};

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface StockItem {
  material: string;
  total_weight_kg: number;
  total_value: number;
  ticket_count: number;
  last_entry: string | null;
}

export function EstoqueFisicoPage() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');

  const fetchStock = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('weighings').select('material_type, net_weight, total_value, created_at').in('status', ['pendente', 'pesado']);

    if (period !== 'all') {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const from = new Date(Date.now() - days * 86400000).toISOString();
      query = query.gte('created_at', from);
    }

    const { data } = await query;
    const map: Record<string, StockItem> = {};

    (data || []).forEach(w => {
      const mat = w.material_type;
      if (!map[mat]) map[mat] = { material: mat, total_weight_kg: 0, total_value: 0, ticket_count: 0, last_entry: null };
      map[mat].total_weight_kg += Number(w.net_weight || 0);
      map[mat].total_value += Number(w.total_value || 0);
      map[mat].ticket_count += 1;
      if (!map[mat].last_entry || w.created_at > map[mat].last_entry!) map[mat].last_entry = w.created_at;
    });

    const items = Object.values(map).sort((a, b) => b.total_weight_kg - a.total_weight_kg);
    setStock(items);
    setLoading(false);
  }, [period]);

  useEffect(() => { fetchStock(); }, [fetchStock]);

  const totalWeight = stock.reduce((s, i) => s + i.total_weight_kg, 0);
  const totalValue = stock.reduce((s, i) => s + i.total_value, 0);
  const totalTickets = stock.reduce((s, i) => s + i.ticket_count, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Estoque Físico</h1>
          <p className="text-sm text-muted-foreground">Materiais em pátio (pesagens pendentes/pesadas)</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo período</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 flex items-center gap-2">
          <Warehouse className="h-8 w-8 text-primary" />
          <div><p className="text-lg font-bold">{(totalWeight / 1000).toFixed(1)}t</p><p className="text-[10px] text-muted-foreground">Peso Total</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <Package className="h-8 w-8 text-accent" />
          <div><p className="text-lg font-bold">{stock.length}</p><p className="text-[10px] text-muted-foreground">Tipos de Material</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <TrendingUp className="h-8 w-8 text-info" />
          <div><p className="text-lg font-bold">{totalTickets}</p><p className="text-[10px] text-muted-foreground">Pesagens</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <TrendingDown className="h-8 w-8 text-warning" />
          <div><p className="text-lg font-bold">{money(totalValue)}</p><p className="text-[10px] text-muted-foreground">Valor Total</p></div>
        </CardContent></Card>
      </div>

      <div className="bg-card rounded border overflow-auto">
        <table className="w-full table-dense">
          <thead><tr className="border-b bg-secondary">
            <th className="text-left text-muted-foreground font-medium">Material</th>
            <th className="text-right text-muted-foreground font-medium">Peso (kg)</th>
            <th className="text-right text-muted-foreground font-medium">Peso (t)</th>
            <th className="text-right text-muted-foreground font-medium">Valor Total</th>
            <th className="text-right text-muted-foreground font-medium">Pesagens</th>
            <th className="text-right text-muted-foreground font-medium">% do Estoque</th>
            <th className="text-left text-muted-foreground font-medium">Última Entrada</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
            ) : stock.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum material em estoque</td></tr>
            ) : stock.map(s => (
              <tr key={s.material} className="border-b border-border/50">
                <td className="font-medium">{MATERIALS[s.material] || s.material}</td>
                <td className="text-right font-mono">{s.total_weight_kg.toFixed(1)}</td>
                <td className="text-right font-mono">{(s.total_weight_kg / 1000).toFixed(2)}</td>
                <td className="text-right font-mono">{money(s.total_value)}</td>
                <td className="text-right">{s.ticket_count}</td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${totalWeight > 0 ? (s.total_weight_kg / totalWeight * 100) : 0}%` }} />
                    </div>
                    <span className="text-[10px] w-8 text-right">{totalWeight > 0 ? (s.total_weight_kg / totalWeight * 100).toFixed(0) : 0}%</span>
                  </div>
                </td>
                <td className="text-muted-foreground">{s.last_entry ? new Date(s.last_entry).toLocaleDateString('pt-BR') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
