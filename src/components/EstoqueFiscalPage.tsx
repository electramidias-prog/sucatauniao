import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { FileText, Search, DollarSign, Scale, Receipt } from 'lucide-react';

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface FiscalEntry {
  id: string;
  ticket_number: number;
  client_name: string;
  material_type: string;
  net_weight: number;
  price_per_kg: number;
  total_value: number;
  status: string;
  settlement_id: string | null;
  created_at: string;
}

const MATERIALS: Record<string, string> = {
  mista: 'Mista', pesada: 'Pesada', limaria: 'Limaria', fundido: 'Fundido',
  amortecedor: 'Amortecedor', ferro: 'Ferro', cobre: 'Cobre',
  aluminio: 'Alumínio', inox: 'Inox', outros: 'Outros',
};

export function EstoqueFiscalPage() {
  const [entries, setEntries] = useState<FiscalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('weighings')
      .select('id, ticket_number, client_id, material_type, net_weight, price_per_kg, total_value, status, settlement_id, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (!data) { setLoading(false); return; }

    const clientIds = [...new Set(data.map(w => w.client_id))];
    const { data: clientsData } = await supabase.from('clients').select('id, name').in('id', clientIds);
    const clientMap: Record<string, string> = {};
    (clientsData || []).forEach(c => { clientMap[c.id] = c.name; });

    setEntries(data.map(w => ({
      ...w,
      client_name: clientMap[w.client_id] || 'Desconhecido',
      net_weight: Number(w.net_weight || 0),
      price_per_kg: Number(w.price_per_kg),
      total_value: Number(w.total_value || 0),
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = entries.filter(e => {
    const s = search.toLowerCase();
    const matchSearch = !search || e.client_name.toLowerCase().includes(s) || String(e.ticket_number).includes(search);
    const matchStatus = filterStatus === 'todos' || e.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalValue = filtered.reduce((s, e) => s + e.total_value, 0);
  const totalWeight = filtered.reduce((s, e) => s + e.net_weight, 0);
  const paidCount = filtered.filter(e => e.status === 'pago').length;
  const pendingCount = filtered.filter(e => e.status === 'pendente').length;

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { pendente: 'badge-pendente', pago: 'badge-pago', pesado: 'badge-finalizado', cancelado: 'badge-bloqueado' };
    return <Badge className={`${map[s] || ''} text-[10px]`}>{s.charAt(0).toUpperCase() + s.slice(1)}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Estoque Fiscal</h1>
        <p className="text-sm text-muted-foreground">Controle fiscal de notas e valores por pesagem</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 flex items-center gap-2">
          <DollarSign className="h-8 w-8 text-primary" />
          <div><p className="text-lg font-bold">{money(totalValue)}</p><p className="text-[10px] text-muted-foreground">Valor Total</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <Scale className="h-8 w-8 text-accent" />
          <div><p className="text-lg font-bold">{(totalWeight / 1000).toFixed(1)}t</p><p className="text-[10px] text-muted-foreground">Peso Total</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <Receipt className="h-8 w-8 text-info" />
          <div><p className="text-lg font-bold">{paidCount}</p><p className="text-[10px] text-muted-foreground">Pagos</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <FileText className="h-8 w-8 text-warning" />
          <div><p className="text-lg font-bold">{pendingCount}</p><p className="text-[10px] text-muted-foreground">Pendentes</p></div>
        </CardContent></Card>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por cliente ou ticket..." className="pl-8 h-8 text-xs" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="pesado">Pesado</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded border overflow-auto">
        <table className="w-full table-dense">
          <thead><tr className="border-b bg-secondary">
            <th className="text-left text-muted-foreground font-medium">Ticket</th>
            <th className="text-left text-muted-foreground font-medium">Data</th>
            <th className="text-left text-muted-foreground font-medium">Cliente</th>
            <th className="text-left text-muted-foreground font-medium">Material</th>
            <th className="text-right text-muted-foreground font-medium">Peso Líq. (kg)</th>
            <th className="text-right text-muted-foreground font-medium">Preço/kg</th>
            <th className="text-right text-muted-foreground font-medium">Total</th>
            <th className="text-center text-muted-foreground font-medium">Status</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</td></tr>
            ) : filtered.map(e => (
              <tr key={e.id} className="border-b border-border/50">
                <td className="font-mono font-medium">#{e.ticket_number}</td>
                <td className="text-muted-foreground">{new Date(e.created_at).toLocaleDateString('pt-BR')}</td>
                <td className="font-medium">{e.client_name}</td>
                <td>{MATERIALS[e.material_type] || e.material_type}</td>
                <td className="text-right font-mono">{e.net_weight.toFixed(1)}</td>
                <td className="text-right font-mono">{money(e.price_per_kg)}</td>
                <td className="text-right font-mono font-semibold">{money(e.total_value)}</td>
                <td className="text-center">{statusBadge(e.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
