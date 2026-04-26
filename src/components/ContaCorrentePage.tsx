import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Search, Wallet, AlertTriangle, Plus, ArrowUpRight, ArrowDownRight, DollarSign, Clock } from 'lucide-react';

interface ClientBalance {
  client_id: string;
  client_name: string;
  nickname: string | null;
  document_number: string;
  pending_materials: number;
  total_debits: number;
  net_balance: number;
  last_activity: string | null;
  days_pending: number;
}

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

export function ContaCorrentePage() {
  const { user } = useAuth();
  const [balances, setBalances] = useState<ClientBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const [debitDialog, setDebitDialog] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [debitForm, setDebitForm] = useState({ description: '', amount: '', type: 'debito' });
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

  const fetchBalances = useCallback(async () => {
    setLoading(true);
    // Fetch clients, pending weighings and open transactions
    const [clientsRes, weighingsRes, transactionsRes] = await Promise.all([
      supabase.from('clients').select('id, name, nickname, document_number').eq('status', 'ativo'),
      supabase.from('weighings').select('client_id, total_value, created_at').eq('status', 'pendente'),
      supabase.from('client_transactions').select('client_id, amount, type, status, created_at').eq('status', 'aberto'),
    ]);

    const clientsList = clientsRes.data || [];
    const weighingsList = weighingsRes.data || [];
    const transactionsList = transactionsRes.data || [];

    setClients(clientsList.map(c => ({ id: c.id, name: c.name })));

    const balanceMap: Record<string, ClientBalance> = {};
    clientsList.forEach(c => {
      balanceMap[c.id] = {
        client_id: c.id,
        client_name: c.name,
        nickname: c.nickname,
        document_number: c.document_number,
        pending_materials: 0,
        total_debits: 0,
        net_balance: 0,
        last_activity: null,
        days_pending: 0,
      };
    });

    weighingsList.forEach(w => {
      if (balanceMap[w.client_id]) {
        balanceMap[w.client_id].pending_materials += Number(w.total_value || 0);
        const date = w.created_at;
        if (!balanceMap[w.client_id].last_activity || date > balanceMap[w.client_id].last_activity!) {
          balanceMap[w.client_id].last_activity = date;
        }
      }
    });

    transactionsList.forEach(t => {
      if (balanceMap[t.client_id]) {
        if (t.type === 'debito') balanceMap[t.client_id].total_debits += Number(t.amount);
        else balanceMap[t.client_id].pending_materials += Number(t.amount);
      }
    });

    Object.values(balanceMap).forEach(b => {
      b.net_balance = b.pending_materials - b.total_debits;
      if (b.last_activity) {
        b.days_pending = Math.floor((Date.now() - new Date(b.last_activity).getTime()) / 86400000);
      }
    });

    // Only show clients with any balance activity
    const active = Object.values(balanceMap).filter(b => b.pending_materials > 0 || b.total_debits > 0);
    active.sort((a, b) => b.net_balance - a.net_balance);
    setBalances(active);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  const filtered = balances.filter(b => {
    const s = search.toLowerCase();
    const matchSearch = !search || b.client_name.toLowerCase().includes(s) || (b.nickname || '').toLowerCase().includes(s) || b.document_number.includes(search);
    if (filter === 'a_receber') return matchSearch && b.net_balance > 0;
    if (filter === 'devendo') return matchSearch && b.net_balance < 0;
    if (filter === 'atrasado') return matchSearch && b.days_pending > 7;
    return matchSearch;
  });

  const totalPending = balances.reduce((s, b) => s + b.pending_materials, 0);
  const totalDebits = balances.reduce((s, b) => s + b.total_debits, 0);
  const totalNet = balances.reduce((s, b) => s + b.net_balance, 0);
  const overdueCount = balances.filter(b => b.days_pending > 7 && b.net_balance > 0).length;

  const handleAddDebit = async () => {
    if (!selectedClientId || !debitForm.amount || !debitForm.description) {
      toast.error('Preencha todos os campos'); return;
    }
    const { error } = await supabase.from('client_transactions').insert({
      client_id: selectedClientId,
      type: debitForm.type,
      description: debitForm.description,
      amount: parseFloat(debitForm.amount),
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(debitForm.type === 'debito' ? 'Débito registrado!' : 'Crédito registrado!');
    setDebitDialog(false);
    setDebitForm({ description: '', amount: '', type: 'debito' });
    setSelectedClientId('');
    fetchBalances();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Conta Corrente</h1>
          <p className="text-sm text-muted-foreground">Saldo e movimentações por cliente</p>
        </div>
        <Button size="sm" onClick={() => setDebitDialog(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Lançar Débito/Crédito
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 flex items-center gap-2">
          <ArrowUpRight className="h-8 w-8 text-accent" />
          <div><p className="text-lg font-bold">{money(totalPending)}</p><p className="text-[10px] text-muted-foreground">A Pagar (Materiais)</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <ArrowDownRight className="h-8 w-8 text-destructive" />
          <div><p className="text-lg font-bold">{money(totalDebits)}</p><p className="text-[10px] text-muted-foreground">Débitos (Vales)</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <DollarSign className="h-8 w-8 text-primary" />
          <div><p className="text-lg font-bold">{money(totalNet)}</p><p className="text-[10px] text-muted-foreground">Saldo Líquido</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <AlertTriangle className="h-8 w-8 text-warning" />
          <div><p className="text-lg font-bold">{overdueCount}</p><p className="text-[10px] text-muted-foreground">Pendentes +7 dias</p></div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..." className="pl-8 h-8 text-xs" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="a_receber">A Receber</SelectItem>
            <SelectItem value="devendo">Devendo</SelectItem>
            <SelectItem value="atrasado">Atrasados (+7d)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded border overflow-auto">
        <table className="w-full table-dense">
          <thead><tr className="border-b bg-secondary">
            <th className="text-left text-muted-foreground font-medium">Cliente</th>
            <th className="text-right text-muted-foreground font-medium">Materiais Pend.</th>
            <th className="text-right text-muted-foreground font-medium">Débitos</th>
            <th className="text-right text-muted-foreground font-medium">Saldo Líquido</th>
            <th className="text-center text-muted-foreground font-medium">Dias Pend.</th>
            <th className="text-center text-muted-foreground font-medium">Status</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma movimentação encontrada</td></tr>
            ) : filtered.map(b => (
              <tr key={b.client_id} className={`border-b border-border/50 ${b.days_pending > 7 && b.net_balance > 0 ? 'bg-destructive/5' : ''}`}>
                <td>
                  <div className="font-medium">{b.client_name}</div>
                  {b.nickname && <div className="text-[10px] text-muted-foreground">{b.nickname}</div>}
                </td>
                <td className="text-right font-mono text-accent">{money(b.pending_materials)}</td>
                <td className="text-right font-mono text-destructive">{money(b.total_debits)}</td>
                <td className={`text-right font-mono font-semibold ${b.net_balance >= 0 ? 'text-accent' : 'text-destructive'}`}>
                  {money(b.net_balance)}
                </td>
                <td className="text-center">
                  {b.days_pending > 0 ? (
                    <span className={`text-xs ${b.days_pending > 7 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                      {b.days_pending}d
                    </span>
                  ) : '—'}
                </td>
                <td className="text-center">
                  {b.days_pending > 7 && b.net_balance > 0 ? (
                    <Badge className="badge-bloqueado text-[10px]"><Clock className="h-3 w-3 mr-0.5" />Atrasado</Badge>
                  ) : b.net_balance > 0 ? (
                    <Badge className="badge-pendente text-[10px]">Pendente</Badge>
                  ) : (
                    <Badge className="badge-finalizado text-[10px]">Em dia</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Debit/Credit Dialog */}
      <Dialog
        open={debitDialog}
        onOpenChange={(o) => {
          setDebitDialog(o);
          if (!o) {
            setSelectedClientId('');
            setDebitForm({ description: '', amount: '', type: 'debito' });
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Lançar Débito / Crédito</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Cliente</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={debitForm.type} onValueChange={v => setDebitForm(p => ({ ...p, type: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="debito">Débito (Vale / Desconto)</SelectItem>
                  <SelectItem value="credito">Crédito (Bônus)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea value={debitForm.description} onChange={e => setDebitForm(p => ({ ...p, description: e.target.value }))} className="text-xs min-h-[60px]" placeholder="Ex: Vale combustível, desconto veículo..." />
            </div>
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input type="number" step="0.01" value={debitForm.amount} onChange={e => setDebitForm(p => ({ ...p, amount: e.target.value }))} className="h-8 text-xs" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDebitDialog(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleAddDebit}>Confirmar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
