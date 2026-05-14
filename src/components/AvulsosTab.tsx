import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { DollarSign, Users, Calendar as CalendarIcon, Download, MessageCircle, CheckCircle2 } from 'lucide-react';

type Frequency = 'semanal' | 'quinzenal' | 'mensal' | 'manual';

interface AvulsoRow {
  weighing_id: string;
  ticket_number: number;
  client_id: string;
  client_name: string;
  pix_key: string | null;
  pix_type: string | null;
  phone: string | null;
  whatsapp: string | null;
  date: string;
  material: string;
  weight_kg: number;
  value: number;
  status: string;
}

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v: number, d = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function lastDayOfMonth(year: number, month: number) {
  return new Date(year, month + 1, 0);
}

function computePeriod(freq: Frequency, ref: Date, manualStart?: string, manualEnd?: string): { start: Date; end: Date; nextPay: Date; label: string } {
  const d = new Date(ref);
  if (freq === 'semanal') {
    // Period: monday..sunday; pay on Friday
    const day = d.getDay(); // 0=Sun
    const diffToMon = (day + 6) % 7;
    const start = new Date(d); start.setDate(d.getDate() - diffToMon); start.setHours(0,0,0,0);
    const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
    const nextPay = new Date(start); nextPay.setDate(start.getDate() + 4); // Friday
    if (nextPay < d) nextPay.setDate(nextPay.getDate() + 7);
    return { start, end, nextPay, label: `${fmtDate(start.toISOString())} - ${fmtDate(end.toISOString())}` };
  }
  if (freq === 'quinzenal') {
    const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
    let start: Date, end: Date, nextPay: Date;
    if (day <= 15) {
      start = new Date(y, m, 1); end = new Date(y, m, 15, 23, 59, 59);
      nextPay = new Date(y, m, 15);
    } else {
      start = new Date(y, m, 16); end = lastDayOfMonth(y, m); end.setHours(23,59,59,999);
      nextPay = lastDayOfMonth(y, m);
    }
    return { start, end, nextPay, label: `${fmtDate(start.toISOString())} - ${fmtDate(end.toISOString())}` };
  }
  if (freq === 'mensal') {
    const y = d.getFullYear(), m = d.getMonth();
    const start = new Date(y, m, 1);
    const end = lastDayOfMonth(y, m); end.setHours(23,59,59,999);
    return { start, end, nextPay: lastDayOfMonth(y, m), label: `${fmtDate(start.toISOString())} - ${fmtDate(end.toISOString())}` };
  }
  // manual
  const start = manualStart ? new Date(manualStart + 'T00:00:00') : new Date(d.getFullYear(), d.getMonth(), 1);
  const end = manualEnd ? new Date(manualEnd + 'T23:59:59') : new Date();
  return { start, end, nextPay: end, label: `${fmtDate(start.toISOString())} - ${fmtDate(end.toISOString())}` };
}

export function AvulsosTab() {
  const { user } = useAuth();
  const [frequency, setFrequency] = useState<Frequency>('semanal');
  const [manualStart, setManualStart] = useState<string>(isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [manualEnd, setManualEnd] = useState<string>(isoDate(new Date()));
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendente' | 'pago'>('todos');
  const [rows, setRows] = useState<AvulsoRow[]>([]);
  const [history, setHistory] = useState<Array<{ period: string; clients: number; total: number; date: string; rows: AvulsoRow[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const period = useMemo(() => computePeriod(frequency, new Date(), manualStart, manualEnd), [frequency, manualStart, manualEnd]);

  const load = useCallback(async () => {
    setLoading(true);
    // Fetch avulso clients
    const { data: avClients } = await supabase
      .from('clients')
      .select('id, name, pix_key, pix_key_type, phone, whatsapp, client_type')
      .in('client_type', ['avulso', 'pesagem_avulsa']);
    const ids = (avClients || []).map(c => c.id);
    if (ids.length === 0) { setRows([]); setHistory([]); setLoading(false); return; }
    const cmap = new Map(avClients!.map(c => [c.id, c]));

    // Period rows (pending or paid in period)
    const { data: weighData } = await supabase
      .from('weighings')
      .select('id, ticket_number, client_id, created_at, material_type, final_net_weight, net_weight, total_value, status')
      .in('client_id', ids)
      .neq('status', 'cancelado')
      .gte('created_at', period.start.toISOString())
      .lte('created_at', period.end.toISOString())
      .order('created_at', { ascending: false });

    const mapped: AvulsoRow[] = (weighData || []).map(w => {
      const c = cmap.get(w.client_id)!;
      return {
        weighing_id: w.id,
        ticket_number: w.ticket_number,
        client_id: w.client_id,
        client_name: c.name,
        pix_key: c.pix_key,
        pix_type: c.pix_key_type,
        phone: c.phone,
        whatsapp: c.whatsapp,
        date: w.created_at,
        material: w.material_type || '—',
        weight_kg: Number(w.final_net_weight ?? w.net_weight ?? 0),
        value: Number(w.total_value || 0),
        status: w.status === 'pago' ? 'pago' : 'pendente',
      };
    });
    setRows(mapped);

    // Historical: paid weighings outside current period (last 6 months)
    const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const { data: histData } = await supabase
      .from('weighings')
      .select('id, ticket_number, client_id, created_at, material_type, final_net_weight, net_weight, total_value, status, updated_at')
      .in('client_id', ids)
      .eq('status', 'pago')
      .gte('updated_at', sixMonthsAgo.toISOString())
      .order('updated_at', { ascending: false });

    // Group by month of payment
    const groups = new Map<string, AvulsoRow[]>();
    (histData || []).forEach(w => {
      // skip if already in current period
      const dt = new Date(w.created_at);
      if (dt >= period.start && dt <= period.end) return;
      const key = new Date(w.updated_at).toISOString().slice(0, 7);
      const c = cmap.get(w.client_id);
      if (!c) return;
      const r: AvulsoRow = {
        weighing_id: w.id,
        ticket_number: w.ticket_number,
        client_id: w.client_id,
        client_name: c.name,
        pix_key: c.pix_key,
        pix_type: c.pix_key_type,
        phone: c.phone,
        whatsapp: c.whatsapp,
        date: w.created_at,
        material: w.material_type || '—',
        weight_kg: Number(w.final_net_weight ?? w.net_weight ?? 0),
        value: Number(w.total_value || 0),
        status: 'pago',
      };
      const arr = groups.get(key) || [];
      arr.push(r);
      groups.set(key, arr);
    });
    const hist = Array.from(groups.entries()).map(([k, items]) => {
      const clientsSet = new Set(items.map(i => i.client_id));
      const total = items.reduce((s, i) => s + i.value, 0);
      return { period: k, clients: clientsSet.size, total, date: k, rows: items };
    }).sort((a, b) => b.period.localeCompare(a.period));
    setHistory(hist);

    setLoading(false);
  }, [period.start, period.end]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (statusFilter === 'todos') return rows;
    return rows.filter(r => r.status === statusFilter);
  }, [rows, statusFilter]);

  const kpi = useMemo(() => {
    const pending = rows.filter(r => r.status === 'pendente');
    const total = pending.reduce((s, r) => s + r.value, 0);
    const distinctClients = new Set(pending.map(r => r.client_id)).size;
    return { total, distinctClients };
  }, [rows]);

  const groupedByClient = useMemo(() => {
    const map = new Map<string, { name: string; pix: string | null; pixType: string | null; rows: AvulsoRow[]; totalKg: number; total: number }>();
    rows.filter(r => r.status === 'pendente').forEach(r => {
      const g = map.get(r.client_id) || { name: r.client_name, pix: r.pix_key, pixType: r.pix_type, rows: [], totalKg: 0, total: 0 };
      g.rows.push(r); g.totalKg += r.weight_kg; g.total += r.value;
      map.set(r.client_id, g);
    });
    return Array.from(map.values());
  }, [rows]);

  const exportReport = () => {
    const headers = ['Cliente', 'Total kg', 'Total R$', 'Chave PIX'];
    const lines = [headers.join(';')];
    let grand = 0;
    groupedByClient.forEach(g => {
      lines.push([g.name, num(g.totalKg), num(g.total, 2), g.pix || ''].join(';'));
      grand += g.total;
    });
    lines.push(['', '', num(grand, 2), 'TOTAL GERAL'].join(';'));
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `avulsos_${period.label.replace(/\s/g, '')}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const sendWhatsApp = (clientId: string) => {
    const g = groupedByClient.find(x => x.name === rows.find(r => r.client_id === clientId)?.client_name);
    const clientRows = rows.filter(r => r.client_id === clientId && r.status === 'pendente');
    if (clientRows.length === 0) { toast.error('Nenhuma pesagem pendente'); return; }
    const phone = (clientRows[0].whatsapp || clientRows[0].phone || '').replace(/\D/g, '');
    if (!phone) { toast.error('Cliente sem telefone'); return; }
    const fullPhone = phone.length <= 11 ? `55${phone}` : phone;
    const total = clientRows.reduce((s, r) => s + r.value, 0);
    const lines = [
      `Olá ${clientRows[0].client_name}! 🏭`,
      `*Sucata União — Pagamento ${period.label}*`,
      '─────────────────',
      ...clientRows.map(r => `${fmtDate(r.date)} | ${r.material} | ${num(r.weight_kg)}kg | ${money(r.value)}`),
      '─────────────────',
      `*Total: ${money(total)}*`,
      `Chave PIX: ${clientRows[0].pix_key || 'não cadastrada'}`,
      'Dúvidas: (31) 99653-5321 ✅',
    ];
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  };

  const confirmPayPeriod = async () => {
    const pending = rows.filter(r => r.status === 'pendente');
    if (pending.length === 0) { toast.error('Sem pendências'); setConfirmOpen(false); return; }
    // Group totals per client
    const perClient = new Map<string, { total: number; ids: string[]; name: string }>();
    pending.forEach(r => {
      const g = perClient.get(r.client_id) || { total: 0, ids: [], name: r.client_name };
      g.total += r.value; g.ids.push(r.weighing_id);
      perClient.set(r.client_id, g);
    });
    const today = isoDate(new Date());
    const txInsert = Array.from(perClient.entries()).map(([client_id, g]) => ({
      client_id,
      type: 'pagamento',
      description: `Pagamento avulso ${period.label}`,
      amount: g.total,
      value: -g.total,
      transaction_date: today,
      created_by: user?.id,
      status: 'aberto',
    }));
    const { error: txErr } = await supabase.from('client_transactions').insert(txInsert);
    if (txErr) { toast.error(txErr.message); return; }
    const allIds = pending.map(r => r.weighing_id);
    const { error: upErr } = await supabase.from('weighings').update({ status: 'pago' }).in('id', allIds);
    if (upErr) { toast.error(upErr.message); return; }
    toast.success(`Período pago! ${perClient.size} cliente(s), ${money(Array.from(perClient.values()).reduce((s,g)=>s+g.total,0))}`);
    setConfirmOpen(false);
    await load();
  };

  const grandTotal = groupedByClient.reduce((s, g) => s + g.total, 0);

  return (
    <div className="space-y-3">
      {/* Period config */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Frequência</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
              <SelectTrigger className="h-8 text-xs w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semanal">Semanal (toda sexta)</SelectItem>
                <SelectItem value="quinzenal">Quinzenal (15 e último)</SelectItem>
                <SelectItem value="mensal">Mensal (último dia do mês)</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {frequency === 'manual' && (
            <>
              <div>
                <Label className="text-xs">Início</Label>
                <Input type="date" value={manualStart} onChange={e => setManualStart(e.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Fim</Label>
                <Input type="date" value={manualEnd} onChange={e => setManualEnd(e.target.value)} className="h-8 text-xs" />
              </div>
            </>
          )}
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="pago">Pagos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={exportReport}>
              <Download className="h-3.5 w-3.5 mr-1" /> Relatório de Pagamento
            </Button>
            <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setConfirmOpen(true)}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Marcar Período como Pago
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-3 flex items-center gap-2">
          <DollarSign className="h-7 w-7 text-destructive" />
          <div>
            <p className="text-base font-bold text-destructive">{money(kpi.total)}</p>
            <p className="text-[10px] text-muted-foreground">Total a pagar — {period.label}</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <Users className="h-7 w-7 text-primary" />
          <div>
            <p className="text-base font-bold">{kpi.distinctClients}</p>
            <p className="text-[10px] text-muted-foreground">Clientes avulsos no período</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <CalendarIcon className="h-7 w-7 text-accent" />
          <div>
            <p className="text-base font-bold">{fmtDate(period.nextPay.toISOString())}</p>
            <p className="text-[10px] text-muted-foreground">Próxima data de pagamento</p>
          </div>
        </CardContent></Card>
      </div>

      {/* Table */}
      <div className="bg-card rounded border overflow-auto">
        <table className="w-full table-dense text-[11px]">
          <thead className="sticky top-0 bg-secondary z-10">
            <tr className="border-b">
              <th className="text-left text-muted-foreground font-medium">Cliente</th>
              <th className="text-left text-muted-foreground font-medium">Data</th>
              <th className="text-left text-muted-foreground font-medium">Material</th>
              <th className="text-right text-muted-foreground font-medium">Peso (kg)</th>
              <th className="text-right text-muted-foreground font-medium">Valor R$</th>
              <th className="text-left text-muted-foreground font-medium">Chave PIX</th>
              <th className="text-center text-muted-foreground font-medium">Status</th>
              <th className="text-center text-muted-foreground font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma pesagem avulsa neste período</td></tr>
            ) : filtered.map(r => (
              <tr key={r.weighing_id} className="border-b border-border/50">
                <td className="font-medium">{r.client_name}</td>
                <td>{fmtDate(r.date)}</td>
                <td className="capitalize">{r.material}</td>
                <td className="text-right font-mono">{num(r.weight_kg)}</td>
                <td className="text-right font-mono text-primary">{money(r.value)}</td>
                <td className="font-mono text-[10px]">{r.pix_key || '—'}</td>
                <td className="text-center">
                  <Badge className={`text-[9px] ${r.status === 'pago' ? 'bg-accent text-accent-foreground' : 'bg-destructive text-destructive-foreground'}`}>
                    {r.status === 'pago' ? 'PAGO' : 'PENDENTE'}
                  </Badge>
                </td>
                <td className="text-center">
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => sendWhatsApp(r.client_id)}>
                    <MessageCircle className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot className="bg-secondary/50">
              <tr className="border-t-2 border-border font-semibold">
                <td colSpan={4} className="text-right">Total Geral:</td>
                <td className="text-right font-mono text-primary">{money(filtered.reduce((s, r) => s + r.value, 0))}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* History */}
      <Card>
        <CardContent className="p-3">
          <div className="text-sm font-semibold mb-2">Histórico de Períodos Pagos</div>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem históricos.</p>
          ) : (
            <Accordion type="single" collapsible>
              {history.map(h => (
                <AccordionItem key={h.period} value={h.period}>
                  <AccordionTrigger className="text-xs">
                    <div className="flex items-center gap-4 w-full">
                      <span className="font-semibold">{h.period}</span>
                      <span className="text-muted-foreground">{h.clients} cliente(s)</span>
                      <span className="text-muted-foreground">{h.rows.length} pesagens</span>
                      <span className="ml-auto font-mono text-accent">{money(h.total)}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <table className="w-full text-[11px]">
                      <thead><tr className="text-muted-foreground"><th className="text-left">Cliente</th><th className="text-left">Data</th><th className="text-left">Material</th><th className="text-right">Peso</th><th className="text-right">Valor</th></tr></thead>
                      <tbody>
                        {h.rows.map(r => (
                          <tr key={r.weighing_id} className="border-b border-border/50">
                            <td>{r.client_name}</td>
                            <td>{fmtDate(r.date)}</td>
                            <td className="capitalize">{r.material}</td>
                            <td className="text-right font-mono">{num(r.weight_kg)}</td>
                            <td className="text-right font-mono">{money(r.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Confirm modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Confirmar Pagamento do Período</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p>Você está prestes a marcar como pagas <strong>{rows.filter(r => r.status === 'pendente').length}</strong> pesagens de <strong>{kpi.distinctClients}</strong> cliente(s) avulso(s).</p>
            <div className="bg-secondary rounded p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Geral</p>
              <p className="text-2xl font-bold text-primary">{money(grandTotal)}</p>
            </div>
            <p className="text-xs text-muted-foreground">Será gerado um lançamento de pagamento para cada cliente e as pesagens serão movidas para o histórico.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={confirmPayPeriod}>Confirmar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
