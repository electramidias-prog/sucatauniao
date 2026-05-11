import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { RefreshButton } from '@/components/RefreshButton';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const MATERIALS: Record<string, string> = {
  mista: 'Mista', pesada: 'Pesada', ferro: 'Ferro', cobre: 'Cobre',
  aluminio: 'Alumínio', inox: 'Inox', outros: 'Outros',
  limaria: 'Limaria', fundido: 'Fundido', amortecedor: 'Amortecedor',
};

const COLORS = [
  'hsl(0, 72%, 40%)', 'hsl(145, 50%, 32%)', 'hsl(38, 92%, 50%)',
  'hsl(210, 80%, 52%)', 'hsl(0, 0%, 40%)', 'hsl(280, 60%, 50%)',
  'hsl(180, 60%, 40%)', 'hsl(30, 80%, 55%)', 'hsl(320, 60%, 50%)', 'hsl(60, 70%, 45%)',
];

export function RelatoriosPage() {
  const [period, setPeriod] = useState('30d');
  const [materialData, setMaterialData] = useState<{ name: string; peso: number; valor: number }[]>([]);
  const [dailyData, setDailyData] = useState<{ dia: string; peso: number; valor: number; tickets: number }[]>([]);
  const [topClients, setTopClients] = useState<{ nome: string; peso: number; tickets: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
    const from = new Date(Date.now() - days * 86400000).toISOString();

    const { data: weighings } = await supabase
      .from('weighings')
      .select('client_id, material_type, net_weight, total_value, created_at')
      .gte('created_at', from)
      .not('status', 'eq', 'cancelado');

    if (!weighings) { setLoading(false); return; }

    // Material breakdown
    const matMap: Record<string, { peso: number; valor: number }> = {};
    weighings.forEach(w => {
      const m = w.material_type;
      if (!matMap[m]) matMap[m] = { peso: 0, valor: 0 };
      matMap[m].peso += Number(w.net_weight || 0);
      matMap[m].valor += Number(w.total_value || 0);
    });
    setMaterialData(Object.entries(matMap).map(([k, v]) => ({ name: MATERIALS[k] || k, ...v })).sort((a, b) => b.peso - a.peso));

    // Daily
    const dayMap: Record<string, { peso: number; valor: number; tickets: number }> = {};
    weighings.forEach(w => {
      const d = new Date(w.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (!dayMap[d]) dayMap[d] = { peso: 0, valor: 0, tickets: 0 };
      dayMap[d].peso += Number(w.net_weight || 0);
      dayMap[d].valor += Number(w.total_value || 0);
      dayMap[d].tickets += 1;
    });
    setDailyData(Object.entries(dayMap).map(([k, v]) => ({ dia: k, ...v })));

    // Top clients
    const clientMap: Record<string, { peso: number; tickets: number }> = {};
    weighings.forEach(w => {
      if (!clientMap[w.client_id]) clientMap[w.client_id] = { peso: 0, tickets: 0 };
      clientMap[w.client_id].peso += Number(w.net_weight || 0);
      clientMap[w.client_id].tickets += 1;
    });
    const topIds = Object.entries(clientMap).sort((a, b) => b[1].peso - a[1].peso).slice(0, 10);

    if (topIds.length > 0) {
      const { data: clients } = await supabase.from('clients').select('id, name').in('id', topIds.map(t => t[0]));
      const nameMap: Record<string, string> = {};
      (clients || []).forEach(c => { nameMap[c.id] = c.name; });
      setTopClients(topIds.map(([id, v]) => ({ nome: nameMap[id] || 'Desconhecido', ...v })));
    } else {
      setTopClients([]);
    }

    setLoading(false);
  }, [period]);

  const { refresh, isRefreshing, lastRefreshAt } = useAutoRefresh(fetchData, [fetchData]);

  const totalPeso = materialData.reduce((s, m) => s + m.peso, 0);
  const totalValor = materialData.reduce((s, m) => s + m.valor, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Relatórios & BI</h1>
          <p className="text-sm text-muted-foreground">Análises e indicadores do pátio</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} lastRefreshAt={lastRefreshAt} />
          <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
            <SelectItem value="365d">Último ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando relatórios...</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Peso Total</p>
              <p className="text-xl font-bold">{(totalPeso / 1000).toFixed(1)}t</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Valor Total</p>
              <p className="text-xl font-bold">{money(totalValor)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Materiais</p>
              <p className="text-xl font-bold">{materialData.length}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Clientes Ativos</p>
              <p className="text-xl font-bold">{topClients.length}</p>
            </CardContent></Card>
          </div>

          {/* Charts Row 1 */}
          <div className="grid lg:grid-cols-2 gap-3">
            <Card className="p-3">
              <p className="text-xs font-semibold mb-3">Evolução Diária (Peso em kg)</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 3%, 84%)" />
                  <XAxis dataKey="dia" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="peso" stroke="hsl(0, 72%, 40%)" fill="hsl(0, 72%, 40%)" fillOpacity={0.15} name="Peso (kg)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-3">
              <p className="text-xs font-semibold mb-3">Distribuição por Material</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={materialData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="peso" paddingAngle={2}>
                    {materialData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => `${(v / 1000).toFixed(2)}t`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                {materialData.map((m, i) => (
                  <div key={m.name} className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-[10px] text-muted-foreground">{m.name}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid lg:grid-cols-2 gap-3">
            <Card className="p-3">
              <p className="text-xs font-semibold mb-3">Peso por Material (kg)</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={materialData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 3%, 84%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                  <Bar dataKey="peso" fill="hsl(0, 72%, 40%)" radius={[4, 4, 0, 0]} name="Peso (kg)" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-3">
              <p className="text-xs font-semibold mb-2">Ranking de Clientes</p>
              <table className="w-full table-dense">
                <thead><tr className="border-b">
                  <th className="text-left text-muted-foreground font-medium">#</th>
                  <th className="text-left text-muted-foreground font-medium">Cliente</th>
                  <th className="text-right text-muted-foreground font-medium">Peso</th>
                  <th className="text-right text-muted-foreground font-medium">Tickets</th>
                </tr></thead>
                <tbody>
                  {topClients.map((c, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="font-semibold text-primary">{i + 1}°</td>
                      <td className="font-medium">{c.nome}</td>
                      <td className="text-right font-mono">{(c.peso / 1000).toFixed(2)}t</td>
                      <td className="text-right">{c.tickets}</td>
                    </tr>
                  ))}
                  {topClients.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-4 text-muted-foreground">Sem dados no período</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
