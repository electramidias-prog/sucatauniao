import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Scale, Weight, Users, DollarSign } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { RefreshButton } from '@/components/RefreshButton';

const MATERIAL_COLORS: Record<string, string> = {
  mista: '#dc2626',
  pesada: '#16a34a',
  limaria: '#ca8a04',
  fundido: '#2563eb',
  amortecedor: '#9333ea',
  outros: '#6b7280',
};

const MATERIAL_LABELS: Record<string, string> = {
  mista: 'Mista',
  pesada: 'Pesada',
  limaria: 'Limaria',
  fundido: 'Fundido',
  amortecedor: 'Amortecedor',
  outros: 'Outros',
};

interface KPIs {
  pesagensHoje: number;
  pesoHoje: number;
  clientesAtivos: number;
  valorPendente: number;
}

interface DiaSerie { dia: string; peso: number }
interface MaterialFatia { name: string; value: number; color: string }
interface TopCliente { client_id: string; nome: string; peso: number; valor: number; tickets: number }

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function ddmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function fmtKg(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

async function fetchKPIs(): Promise<KPIs> {
  const todayISO = startOfTodayISO();

  const [todayRows, clientesRes, pendentesRes] = await Promise.all([
    supabase
      .from('weighings')
      .select('net_weight, status')
      .gte('created_at', todayISO)
      .neq('status', 'cancelado'),
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ativo'),
    supabase
      .from('weighings')
      .select('total_value')
      .eq('status', 'pendente'),
  ]);

  const pesagensHoje = todayRows.data?.length ?? 0;
  const pesoHoje = (todayRows.data ?? []).reduce((s, r: any) => s + (Number(r.net_weight) || 0), 0);
  const clientesAtivos = clientesRes.count ?? 0;
  const valorPendente = (pendentesRes.data ?? []).reduce((s, r: any) => s + (Number(r.total_value) || 0), 0);

  return { pesagensHoje, pesoHoje, clientesAtivos, valorPendente };
}

async function fetchSerie7d(): Promise<DiaSerie[]> {
  const since = daysAgoISO(6);
  const { data } = await supabase
    .from('weighings')
    .select('created_at, net_weight, status')
    .gte('created_at', since)
    .neq('status', 'cancelado');

  const buckets = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  (data ?? []).forEach((r: any) => {
    const key = new Date(r.created_at).toISOString().slice(0, 10);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) || 0) + (Number(r.net_weight) || 0));
    }
  });
  return Array.from(buckets.entries()).map(([k, v]) => ({ dia: ddmm(k), peso: Number(v.toFixed(1)) }));
}

async function fetchMateriais30d(): Promise<MaterialFatia[]> {
  const since = daysAgoISO(30);
  const { data } = await supabase
    .from('weighings')
    .select('material_type, net_weight, status')
    .gte('created_at', since)
    .neq('status', 'cancelado');

  const sums = new Map<string, number>();
  (data ?? []).forEach((r: any) => {
    const key = (r.material_type || 'outros').toLowerCase();
    const bucket = MATERIAL_COLORS[key] ? key : 'outros';
    sums.set(bucket, (sums.get(bucket) || 0) + (Number(r.net_weight) || 0));
  });
  return Array.from(sums.entries())
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      name: MATERIAL_LABELS[k] ?? k,
      value: Number(v.toFixed(1)),
      color: MATERIAL_COLORS[k] ?? MATERIAL_COLORS.outros,
    }));
}

async function fetchTopClientes30d(): Promise<TopCliente[]> {
  const since = daysAgoISO(30);
  const { data } = await supabase
    .from('weighings')
    .select('client_id, net_weight, total_value, status')
    .gte('created_at', since)
    .neq('status', 'cancelado');

  const agg = new Map<string, { peso: number; valor: number; tickets: number }>();
  (data ?? []).forEach((r: any) => {
    if (!r.client_id) return;
    const cur = agg.get(r.client_id) || { peso: 0, valor: 0, tickets: 0 };
    cur.peso += Number(r.net_weight) || 0;
    cur.valor += Number(r.total_value) || 0;
    cur.tickets += 1;
    agg.set(r.client_id, cur);
  });

  const ids = Array.from(agg.keys());
  if (ids.length === 0) return [];

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .in('id', ids);
  const nameMap = new Map<string, string>();
  (clients ?? []).forEach((c: any) => nameMap.set(c.id, c.name));

  return ids
    .map((id) => ({
      client_id: id,
      nome: nameMap.get(id) || '—',
      peso: agg.get(id)!.peso,
      valor: agg.get(id)!.valor,
      tickets: agg.get(id)!.tickets,
    }))
    .sort((a, b) => b.peso - a.peso)
    .slice(0, 5);
}

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [serie, setSerie] = useState<DiaSerie[]>([]);
  const [materiais, setMateriais] = useState<MaterialFatia[]>([]);
  const [topClientes, setTopClientes] = useState<TopCliente[]>([]);

  const loadAll = async () => {
    try {
      const [k, s, m, t] = await Promise.all([
        fetchKPIs(),
        fetchSerie7d(),
        fetchMateriais30d(),
        fetchTopClientes30d(),
      ]);
      setKpis(k);
      setSerie(s);
      setMateriais(m);
      setTopClientes(t);
    } catch (e) {
      console.error('Dashboard load error', e);
    } finally {
      setLoading(false);
    }
  };

  const { refresh, isRefreshing, lastRefreshAt } = useAutoRefresh(loadAll);

  const cards = [
    { label: 'Pesagens Hoje', value: kpis ? String(kpis.pesagensHoje) : '—', icon: Scale },
    { label: 'Peso Total Hoje (kg)', value: kpis ? fmtKg(kpis.pesoHoje) : '—', icon: Weight },
    { label: 'Clientes Ativos', value: kpis ? String(kpis.clientesAtivos) : '—', icon: Users },
    { label: 'Valor a Pagar', value: kpis ? fmtBRL(kpis.valorPendente) : '—', icon: DollarSign },
  ];

  const serieHasData = serie.some((d) => d.peso > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Visão geral do pátio em tempo real</p>
        </div>
        <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} lastRefreshAt={lastRefreshAt} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="p-3">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{c.label}</p>
                {loading ? (
                  <Skeleton className="h-6 w-20 mt-1" />
                ) : (
                  <p className="text-xl font-bold mt-0.5 truncate">{c.value}</p>
                )}
              </div>
              <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                <c.icon className="h-4 w-4 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2 p-3">
          <p className="text-xs font-semibold mb-3">Pesagens últimos 7 dias (kg)</p>
          {loading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : serieHasData ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={serie}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ fontSize: 11 }}
                  formatter={(v: number) => [`${fmtKg(v)} kg`, 'Peso']}
                />
                <Area
                  type="monotone"
                  dataKey="peso"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.18}
                  name="Peso"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
              Nenhum dado no período
            </div>
          )}
        </Card>

        <Card className="p-3">
          <p className="text-xs font-semibold mb-3">Materiais (30 dias)</p>
          {loading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : materiais.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={materiais}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {materiais.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 11 }}
                    formatter={(v: number) => [`${fmtKg(v)} kg`, 'Peso']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                {materiais.map((m) => (
                  <div key={m.name} className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                    <span className="text-[10px] text-muted-foreground">{m.name}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
              Nenhum dado no período
            </div>
          )}
        </Card>
      </div>

      {/* Top Clientes */}
      <Card className="p-3">
        <p className="text-xs font-semibold mb-2">Top 5 clientes (últimos 30 dias)</p>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : topClientes.length > 0 ? (
          <table className="w-full table-dense text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left text-muted-foreground font-medium py-1">Cliente</th>
                <th className="text-right text-muted-foreground font-medium py-1">Total kg</th>
                <th className="text-right text-muted-foreground font-medium py-1">Total R$</th>
                <th className="text-right text-muted-foreground font-medium py-1">Tickets</th>
              </tr>
            </thead>
            <tbody>
              {topClientes.map((c) => (
                <tr key={c.client_id} className="border-b border-border/50">
                  <td className="font-medium py-1 truncate max-w-[260px]">{c.nome}</td>
                  <td className="text-right font-mono py-1">{fmtKg(c.peso)}</td>
                  <td className="text-right font-mono py-1">{fmtBRL(c.valor)}</td>
                  <td className="text-right py-1">{c.tickets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">
            Nenhum dado no período
          </div>
        )}
      </Card>
    </div>
  );
}