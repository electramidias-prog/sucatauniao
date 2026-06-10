import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Warehouse, Package, TrendingUp, TrendingDown, Truck, Settings, Plus, Minus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const MATERIALS: Record<string, string> = {
  mista: 'Sucata Mista', pesada: 'Sucata Pesada', limaria: 'Limaria', fundido: 'Fundido',
  amortecedor: 'Amortecedor', aluminio: 'Alumínio', cobre: 'Cobre', bronze: 'Bronze',
  inox: 'Inox', outros: 'Outros',
};
const MAT_KEYS = Object.keys(MATERIALS);
const BUYERS = ['Vale', 'Gerdau', 'Ternium', 'CSR', 'Outros'];
const ADJ_REASONS = ['Inventário', 'Perda', 'Erro de registro', 'Outros'];

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtKg = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

interface StockItem {
  id: string;
  material_type: string;
  current_quantity_kg: number;
  price_per_kg: number;
  carreta_target_kg: number;
  last_entry_at: string | null;
  last_exit_at: string | null;
}

interface Movement {
  id: string;
  material_type: string;
  movement_type: string;
  quantity_kg: number;
  origin_type: string | null;
  origin_id: string | null;
  destination: string | null;
  responsible_id: string | null;
  observation: string | null;
  invoice_number: string | null;
  adjustment_reason: string | null;
  created_by: string | null;
  created_at: string;
}

export function EstoqueFisicoPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canEdit = !!user; // any authenticated user can create/edit movements
  const [items, setItems] = useState<StockItem[]>([]);
  const [moves, setMoves] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMat, setFilterMat] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('30d');
  const [exitOpen, setExitOpen] = useState(false);
  const [adjOpen, setAdjOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState<StockItem | null>(null);

  // Exit form
  const [ex, setEx] = useState({ material: 'mista', quantity: '', buyer: 'Vale', invoice: '', date: new Date().toISOString().slice(0,10), driver: '', obs: '' });
  // Adjust form
  const [aj, setAj] = useState({ material: 'mista', kind: 'add', quantity: '', reason: 'Inventário', obs: '' });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: si }, movesQ] = await Promise.all([
      supabase.from('stock_items').select('*').order('material_type'),
      buildMovesQuery(),
    ]);
    setItems((si as StockItem[]) || []);
    setMoves((movesQ.data as Movement[]) || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMat, filterType, filterPeriod]);

  function buildMovesQuery() {
    let q = supabase.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(500);
    if (filterMat !== 'all') q = q.eq('material_type', filterMat);
    if (filterType !== 'all') q = q.eq('movement_type', filterType);
    if (filterPeriod !== 'all') {
      const days = filterPeriod === '7d' ? 7 : filterPeriod === '30d' ? 30 : 90;
      q = q.gte('created_at', new Date(Date.now() - days * 86400000).toISOString());
    }
    return q;
  }

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const totalKg = items.reduce((s, i) => s + Number(i.current_quantity_kg), 0);
  const totalValue = items.reduce((s, i) => s + Number(i.current_quantity_kg) * Number(i.price_per_kg), 0);

  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const entriesToday = moves.filter(m => m.movement_type === 'entrada' && new Date(m.created_at) >= todayStart).reduce((s,m) => s + Number(m.quantity_kg), 0);
  const exitsMonth = moves.filter(m => m.movement_type === 'saida' && new Date(m.created_at) >= monthStart).reduce((s,m) => s + Number(m.quantity_kg), 0);

  async function createCalendarEvent(material: string, kg: number) {
    if (!user) return;
    await supabase.from('calendar_events').insert({
      title: `🏭 ${MATERIALS[material]} pronto para carregar (${(kg/1000).toFixed(1)}t)`,
      event_date: new Date().toISOString().slice(0,10),
      category: 'logistica',
      description: `Estoque atingiu o peso alvo para fechar uma carreta.`,
      created_by: user.id,
    });
  }

  async function checkCarretaAlerts() {
    const { data } = await supabase.from('stock_items').select('*');
    (data || []).forEach((it: any) => {
      if (Number(it.current_quantity_kg) >= Number(it.carreta_target_kg) && Number(it.carreta_target_kg) > 0) {
        createCalendarEvent(it.material_type, Number(it.current_quantity_kg));
      }
    });
  }

  async function submitExit() {
    if (!user) return;
    const qty = parseFloat(ex.quantity);
    if (!qty || qty <= 0) { toast({ title: 'Quantidade inválida', variant: 'destructive' }); return; }
    const { error } = await supabase.from('stock_movements').insert({
      material_type: ex.material,
      movement_type: 'saida',
      quantity_kg: qty,
      origin_type: 'manual',
      destination: ex.buyer,
      invoice_number: ex.invoice || null,
      observation: `${ex.driver ? 'Motorista: ' + ex.driver + '. ' : ''}${ex.obs}`.trim() || null,
      created_by: user.id,
    });
    if (error) { toast({ title: 'Erro ao registrar saída', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Saída registrada' });
    setExitOpen(false);
    setEx({ material: 'mista', quantity: '', buyer: 'Vale', invoice: '', date: new Date().toISOString().slice(0,10), driver: '', obs: '' });
    fetchAll();
  }

  async function submitAdjust() {
    if (!user) return;
    const qty = parseFloat(aj.quantity);
    if (!qty || qty <= 0) { toast({ title: 'Quantidade inválida', variant: 'destructive' }); return; }
    const signed = aj.kind === 'add' ? qty : -qty;
    const { error } = await supabase.from('stock_movements').insert({
      material_type: aj.material,
      movement_type: 'ajuste',
      quantity_kg: signed,
      origin_type: 'ajuste',
      adjustment_reason: aj.reason,
      observation: aj.obs || null,
      created_by: user.id,
    });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    await supabase.from('audit_logs').insert({
      action: 'STOCK_ADJUSTMENT', table_name: 'stock_movements',
      user_id: user.id,
      new_value: { material: aj.material, kind: aj.kind, quantity: qty, reason: aj.reason, obs: aj.obs },
    });
    toast({ title: 'Ajuste registrado' });
    setAdjOpen(false);
    setAj({ material: 'mista', kind: 'add', quantity: '', reason: 'Inventário', obs: '' });
    fetchAll();
    checkCarretaAlerts();
  }

  async function saveTarget(item: StockItem, newTarget: number) {
    const { error } = await supabase.from('stock_items').update({ carreta_target_kg: newTarget }).eq('id', item.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Peso alvo atualizado' });
    setTargetOpen(null);
    fetchAll();
  }

  function carretaBadge(item: StockItem) {
    const qty = Number(item.current_quantity_kg);
    const target = Number(item.carreta_target_kg);
    if (target <= 0) return <span className="text-[10px] text-muted-foreground">—</span>;
    const pct = (qty / target) * 100;
    if (pct >= 100) return <Badge className="bg-success text-success-foreground text-[10px]">PRONTO {(target/1000).toFixed(0)}t</Badge>;
    if (pct >= 70) return <Badge className="bg-warning text-warning-foreground text-[10px]">{pct.toFixed(0)}% completo</Badge>;
    return <span className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</span>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Estoque Físico</h1>
          <p className="text-sm text-muted-foreground">Material no pátio — entradas via balança, saídas para compradores</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setExitOpen(true)}><Truck className="h-4 w-4 mr-1" />Registrar Saída</Button>
          <Button size="sm" variant="outline" onClick={() => setAdjOpen(true)}><Settings className="h-4 w-4 mr-1" />Ajuste Manual</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 flex items-center gap-2">
          <Warehouse className="h-8 w-8 text-primary" />
          <div><p className="text-lg font-bold">{(totalKg/1000).toFixed(1)}t</p><p className="text-[10px] text-muted-foreground">Estoque Total ({fmtKg(totalKg)} kg)</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <Package className="h-8 w-8 text-accent" />
          <div><p className="text-lg font-bold">{money(totalValue)}</p><p className="text-[10px] text-muted-foreground">Valor em Estoque</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <TrendingUp className="h-8 w-8 text-success" />
          <div><p className="text-lg font-bold">{fmtKg(entriesToday)} kg</p><p className="text-[10px] text-muted-foreground">Entradas hoje</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <TrendingDown className="h-8 w-8 text-warning" />
          <div><p className="text-lg font-bold">{fmtKg(exitsMonth)} kg</p><p className="text-[10px] text-muted-foreground">Saídas este mês</p></div>
        </CardContent></Card>
      </div>

      {/* Stock per material */}
      <div className="bg-card rounded border overflow-auto">
        <div className="px-3 py-2 border-b bg-secondary/50 text-xs font-medium">Estoque por Material</div>
        <table className="w-full table-dense">
          <thead><tr className="border-b bg-secondary">
            <th className="text-left text-muted-foreground font-medium">Material</th>
            <th className="text-right text-muted-foreground font-medium">Estoque (kg)</th>
            <th className="text-right text-muted-foreground font-medium">Preço R$/kg</th>
            <th className="text-right text-muted-foreground font-medium">Valor</th>
            <th className="text-left text-muted-foreground font-medium">Última Entrada</th>
            <th className="text-left text-muted-foreground font-medium">Última Saída</th>
            <th className="text-center text-muted-foreground font-medium">Carreta</th>
            <th className="text-center text-muted-foreground font-medium">Ações</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">Carregando...</td></tr>
              : items.map(it => (
              <tr key={it.id} className="border-b border-border/50">
                <td className="font-medium">{MATERIALS[it.material_type] || it.material_type}</td>
                <td className="text-right font-mono">{fmtKg(Number(it.current_quantity_kg))}</td>
                <td className="text-right font-mono">{money(Number(it.price_per_kg))}</td>
                <td className="text-right font-mono">{money(Number(it.current_quantity_kg) * Number(it.price_per_kg))}</td>
                <td className="text-muted-foreground text-xs">{it.last_entry_at ? new Date(it.last_entry_at).toLocaleString('pt-BR') : '—'}</td>
                <td className="text-muted-foreground text-xs">{it.last_exit_at ? new Date(it.last_exit_at).toLocaleString('pt-BR') : '—'}</td>
                <td className="text-center">{carretaBadge(it)}</td>
                <td className="text-center">
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setTargetOpen(it)}>Configurar</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Movements */}
      <div className="bg-card rounded border">
        <div className="px-3 py-2 border-b bg-secondary/50 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-medium">Histórico de Movimentações</span>
          <div className="flex gap-2">
            <Select value={filterMat} onValueChange={setFilterMat}>
              <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos materiais</SelectItem>
                {MAT_KEYS.map(m => <SelectItem key={m} value={m}>{MATERIALS[m]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos tipos</SelectItem>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="saida">Saída</SelectItem>
                <SelectItem value="ajuste">Ajuste</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPeriod} onValueChange={setFilterPeriod}>
              <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 dias</SelectItem>
                <SelectItem value="30d">30 dias</SelectItem>
                <SelectItem value="90d">90 dias</SelectItem>
                <SelectItem value="all">Tudo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-auto max-h-[420px]">
          <table className="w-full table-dense">
            <thead className="sticky top-0"><tr className="border-b bg-secondary">
              <th className="text-left text-muted-foreground font-medium">Data</th>
              <th className="text-left text-muted-foreground font-medium">Tipo</th>
              <th className="text-left text-muted-foreground font-medium">Material</th>
              <th className="text-right text-muted-foreground font-medium">Qtd (kg)</th>
              <th className="text-left text-muted-foreground font-medium">Origem</th>
              <th className="text-left text-muted-foreground font-medium">Destino</th>
              <th className="text-left text-muted-foreground font-medium">Observação</th>
            </tr></thead>
            <tbody>
              {moves.length === 0 ? <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Nenhuma movimentação</td></tr>
                : moves.map(m => (
                <tr key={m.id} className="border-b border-border/50">
                  <td className="text-xs whitespace-nowrap">{new Date(m.created_at).toLocaleString('pt-BR')}</td>
                  <td>
                    {m.movement_type === 'entrada' && <Badge className="bg-success text-success-foreground text-[10px]">ENTRADA</Badge>}
                    {m.movement_type === 'saida' && <Badge className="bg-warning text-warning-foreground text-[10px]">SAÍDA</Badge>}
                    {m.movement_type === 'ajuste' && <Badge variant="outline" className="text-[10px]">AJUSTE</Badge>}
                  </td>
                  <td>{MATERIALS[m.material_type] || m.material_type}</td>
                  <td className={`text-right font-mono ${Number(m.quantity_kg) < 0 ? 'text-destructive' : ''}`}>{fmtKg(Number(m.quantity_kg))}</td>
                  <td className="text-xs">{m.origin_type === 'ticket' ? `Ticket #${m.origin_id}` : (m.origin_type || '—')}</td>
                  <td className="text-xs">{m.destination || (m.adjustment_reason ? `Ajuste: ${m.adjustment_reason}` : '—')}</td>
                  <td className="text-xs text-muted-foreground truncate max-w-xs">{m.observation || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exit dialog */}
      <Dialog open={exitOpen} onOpenChange={setExitOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Saída de Material</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Material</Label>
              <Select value={ex.material} onValueChange={v => setEx({ ...ex, material: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{MAT_KEYS.map(m => <SelectItem key={m} value={m}>{MATERIALS[m]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Quantidade (kg)</Label><Input type="number" value={ex.quantity} onChange={e => setEx({ ...ex, quantity: e.target.value })} /></div>
            <div><Label>Empresa Compradora</Label>
              <Select value={ex.buyer} onValueChange={v => setEx({ ...ex, buyer: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{BUYERS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>NF-e nº</Label><Input value={ex.invoice} onChange={e => setEx({ ...ex, invoice: e.target.value })} /></div>
              <div><Label>Data</Label><Input type="date" value={ex.date} onChange={e => setEx({ ...ex, date: e.target.value })} /></div>
            </div>
            <div><Label>Motorista</Label><Input value={ex.driver} onChange={e => setEx({ ...ex, driver: e.target.value })} /></div>
            <div><Label>Observação</Label><Textarea rows={2} value={ex.obs} onChange={e => setEx({ ...ex, obs: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExitOpen(false)}>Cancelar</Button>
            <Button onClick={submitExit}><Truck className="h-4 w-4 mr-1" />Registrar Saída</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust dialog */}
      <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ajuste Manual de Estoque</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Material</Label>
              <Select value={aj.material} onValueChange={v => setAj({ ...aj, material: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{MAT_KEYS.map(m => <SelectItem key={m} value={m}>{MATERIALS[m]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tipo</Label>
              <Select value={aj.kind} onValueChange={v => setAj({ ...aj, kind: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="add"><Plus className="h-3 w-3 inline mr-1" />Adição</SelectItem>
                  <SelectItem value="sub"><Minus className="h-3 w-3 inline mr-1" />Subtração</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Quantidade (kg)</Label><Input type="number" value={aj.quantity} onChange={e => setAj({ ...aj, quantity: e.target.value })} /></div>
            <div><Label>Motivo</Label>
              <Select value={aj.reason} onValueChange={v => setAj({ ...aj, reason: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{ADJ_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Observação</Label><Textarea rows={2} value={aj.obs} onChange={e => setAj({ ...aj, obs: e.target.value })} /></div>
            <p className="text-[11px] text-muted-foreground">Esta operação será registrada no log de auditoria.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjOpen(false)}>Cancelar</Button>
            <Button onClick={submitAdjust}>Confirmar Ajuste</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Target dialog */}
      <Dialog open={!!targetOpen} onOpenChange={() => setTargetOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Peso alvo da carreta — {targetOpen && MATERIALS[targetOpen.material_type]}</DialogTitle></DialogHeader>
          {targetOpen && <TargetEditor item={targetOpen} onSave={saveTarget} onCancel={() => setTargetOpen(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TargetEditor({ item, onSave, onCancel }: { item: StockItem; onSave: (i: StockItem, n: number) => void; onCancel: () => void; }) {
  const [v, setV] = useState(String(item.carreta_target_kg));
  return (
    <div className="space-y-3">
      <div><Label>Peso alvo (kg)</Label><Input type="number" value={v} onChange={e => setV(e.target.value)} /></div>
      <p className="text-[11px] text-muted-foreground">Quando o estoque atingir este valor, um alerta aparecerá no Calendário.</p>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onSave(item, parseFloat(v) || 0)}>Salvar</Button>
      </DialogFooter>
    </div>
  );
}
