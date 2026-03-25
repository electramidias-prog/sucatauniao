import { Card } from '@/components/ui/card';
import { Scale, Warehouse, Users, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';

const stats = [
  { label: 'Pesagens Hoje', value: '18', icon: Scale, change: '+3', up: true },
  { label: 'Estoque Total (t)', value: '342.5', icon: Warehouse, change: '+12.8', up: true },
  { label: 'Clientes Ativos', value: '87', icon: Users, change: '+2', up: true },
  { label: 'Faturamento Mês', value: 'R$ 148.2k', icon: TrendingUp, change: '-5%', up: false },
];

const entradaSaida = [
  { dia: '01', entrada: 12.5, saida: 8.2 },
  { dia: '05', entrada: 18.3, saida: 15.1 },
  { dia: '10', entrada: 22.1, saida: 19.6 },
  { dia: '15', entrada: 15.7, saida: 12.3 },
  { dia: '20', entrada: 28.4, saida: 22.8 },
  { dia: '25', entrada: 19.2, saida: 16.5 },
];

const materiaisData = [
  { name: 'Ferro', value: 180, color: 'hsl(152, 45%, 22%)' },
  { name: 'Cobre', value: 45, color: 'hsl(85, 35%, 45%)' },
  { name: 'Alumínio', value: 62, color: 'hsl(38, 92%, 50%)' },
  { name: 'Inox', value: 28, color: 'hsl(210, 80%, 52%)' },
  { name: 'Outros', value: 27.5, color: 'hsl(200, 10%, 45%)' },
];

const topClientes = [
  { nome: 'Metalúrgica Silva', peso: '48.2t', tickets: 12 },
  { nome: 'Auto Peças Central', peso: '32.7t', tickets: 8 },
  { nome: 'Construtora ABC', peso: '28.1t', tickets: 6 },
  { nome: 'Oficina do João', peso: '19.5t', tickets: 15 },
  { nome: 'Ferro Velho Boa Vista', peso: '15.3t', tickets: 4 },
];

export function DashboardPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">Dashboard</h1>
        <p className="text-xs text-muted-foreground">Visão geral do pátio em tempo real</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{s.label}</p>
                <p className="text-xl font-bold mt-0.5">{s.value}</p>
              </div>
              <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                <s.icon className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              {s.up ? (
                <ArrowUpRight className="h-3 w-3 text-success" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-destructive" />
              )}
              <span className={`text-[10px] font-medium ${s.up ? 'text-success' : 'text-destructive'}`}>
                {s.change}
              </span>
              <span className="text-[10px] text-muted-foreground">vs ontem</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-3">
        {/* Area Chart - Entrada/Saída */}
        <Card className="lg:col-span-2 p-3">
          <p className="text-xs font-semibold mb-3">Entrada vs Saída (toneladas)</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={entradaSaida}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(200, 12%, 85%)" />
              <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="entrada" stroke="hsl(152, 45%, 22%)" fill="hsl(152, 45%, 22%)" fillOpacity={0.15} name="Entrada" />
              <Area type="monotone" dataKey="saida" stroke="hsl(85, 35%, 45%)" fill="hsl(85, 35%, 45%)" fillOpacity={0.15} name="Saída" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Pie Chart - Materiais */}
        <Card className="p-3">
          <p className="text-xs font-semibold mb-3">Estoque por Material</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={materiaisData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                dataKey="value"
                paddingAngle={2}
              >
                {materiaisData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => `${v}t`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
            {materiaisData.map((m) => (
              <div key={m.name} className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                <span className="text-[10px] text-muted-foreground">{m.name}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-2 gap-3">
        {/* Top Clientes */}
        <Card className="p-3">
          <p className="text-xs font-semibold mb-2">Top Clientes do Mês</p>
          <table className="w-full table-dense">
            <thead>
              <tr className="border-b">
                <th className="text-left text-muted-foreground font-medium">Cliente</th>
                <th className="text-right text-muted-foreground font-medium">Peso</th>
                <th className="text-right text-muted-foreground font-medium">Tickets</th>
              </tr>
            </thead>
            <tbody>
              {topClientes.map((c, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="font-medium">{c.nome}</td>
                  <td className="text-right font-mono">{c.peso}</td>
                  <td className="text-right">{c.tickets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Últimas pesagens */}
        <Card className="p-3">
          <p className="text-xs font-semibold mb-2">Últimas Pesagens</p>
          <table className="w-full table-dense">
            <thead>
              <tr className="border-b">
                <th className="text-left text-muted-foreground font-medium">Ticket</th>
                <th className="text-left text-muted-foreground font-medium">Placa</th>
                <th className="text-left text-muted-foreground font-medium">Material</th>
                <th className="text-right text-muted-foreground font-medium">Líquido</th>
                <th className="text-right text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { ticket: '#1847', placa: 'ABC-1234', material: 'Ferro', liquido: '3.2t', status: 'Finalizado' },
                { ticket: '#1846', placa: 'DEF-5678', material: 'Cobre', liquido: '0.8t', status: 'Aberto' },
                { ticket: '#1845', placa: 'GHI-9012', material: 'Alumínio', liquido: '1.5t', status: 'Finalizado' },
                { ticket: '#1844', placa: 'JKL-3456', material: 'Mista', liquido: '4.1t', status: 'Pendente' },
                { ticket: '#1843', placa: 'MNO-7890', material: 'Inox', liquido: '0.6t', status: 'Finalizado' },
              ].map((p) => (
                <tr key={p.ticket} className="border-b border-border/50">
                  <td className="font-mono font-medium">{p.ticket}</td>
                  <td>{p.placa}</td>
                  <td>{p.material}</td>
                  <td className="text-right font-mono">{p.liquido}</td>
                  <td className="text-right">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      p.status === 'Finalizado' ? 'badge-finalizado' :
                      p.status === 'Aberto' ? 'badge-aberto' : 'badge-pendente'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
