import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeftRight, Plus, CheckCircle2, DollarSign, Edit3, Download, FileText,
  Upload, X, Eye, Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { logAudit } from './balanca/auditLog';
import { exportTable, type ExportFormat } from './balanca/exportTable';

// ─────────── Types ───────────
type TransferStatus = 'em_aberto' | 'aprovado' | 'pago';
type PaymentMethod = 'pix' | 'ted' | 'dinheiro' | 'outro';

interface Transfer {
  id: string;
  origin: 'ticket' | 'manual';
  weighing_id: string | null;
  client_id: string | null;
  beneficiary_name: string | null;
  beneficiary_cpf: string | null;
  beneficiary_address: string | null;
  amount: number;
  original_amount: number;
  adjustment_amount: number;
  adjustment_reason: string | null;
  payment_method: PaymentMethod | null;
  payment_proof_url: string | null;
  payment_notes: string | null;
  paid_at: string | null;
  paid_by: string | null;
  status: TransferStatus;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  description: string | null;
  clients?: { id: string; name: string; document_number: string | null } | null;
  weighings?: { id: string; ticket_number: number } | null;
  paid_profile?: { full_name: string | null } | null;
}

interface ClientLite {
  id: string;
  name: string;
  document_number: string | null;
}

// ─────────── Helpers ───────────
const fmtBRL = (n: number) =>
  (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('pt-BR') : '—';
const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString('pt-BR') : '—';

const StatusBadge = ({ status }: { status: TransferStatus }) => {
  if (status === 'em_aberto')
    return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border border-yellow-300">Em Aberto</Badge>;
  if (status === 'aprovado')
    return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border border-green-300">Aprovado</Badge>;
  return <Badge className="bg-zinc-200 text-zinc-700 hover:bg-zinc-200 border border-zinc-300">Pago</Badge>;
};

const PMLabel: Record<PaymentMethod, string> = {
  pix: 'PIX', ted: 'TED', dinheiro: 'Dinheiro', outro: 'Outro',
};

// ─────────── Proof Upload ───────────
function ProofUploader({
  value, onChange,
}: { value: string | null; onChange: (url: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const upload = useCallback(async (file: File) => {
    const ok = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!ok) { toast.error('Anexe uma imagem ou PDF'); return; }
    setBusy(true);
    try {
      const ext = (file.name.split('.').pop() || file.type.split('/')[1] || 'bin').toLowerCase();
      const path = `proofs/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('transfer-proofs').upload(path, file, {
        contentType: file.type, upsert: true,
      });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from('transfer-proofs').createSignedUrl(path, 60 * 60 * 24 * 365);
      onChange(signed?.signedUrl || path);
      toast.success('Comprovante anexado');
    } catch (e: any) {
      toast.error('Erro ao enviar: ' + (e?.message || ''));
    } finally { setBusy(false); }
  }, [onChange]);

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/') || item.type === 'application/pdf') {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            const ext = (blob.type.split('/')[1] || 'png').split(';')[0];
            upload(new File([blob], `comprovante-${Date.now()}.${ext}`, { type: blob.type }));
          }
          break;
        }
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [upload]);

  return (
    <div ref={rootRef} className="space-y-2">
      {value ? (
        <div className="flex items-center gap-2 p-2 border rounded bg-muted/30">
          <FileText className="h-4 w-4 text-primary" />
          <a href={value} target="_blank" rel="noreferrer" className="text-xs text-primary underline truncate flex-1">
            Comprovante anexado
          </a>
          <Button size="sm" variant="ghost" onClick={() => onChange(null)} className="h-6 w-6 p-0">
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
          className="border-2 border-dashed border-muted rounded p-3 text-center text-xs text-muted-foreground space-y-2"
        >
          <div>Clique aqui e cole (Ctrl+V) imagem ou PDF</div>
          <label className="inline-flex">
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
            />
            <span className="inline-flex items-center gap-1 px-2 py-1 border rounded bg-background cursor-pointer hover:bg-muted">
              <Upload className="h-3 w-3" /> {busy ? 'Enviando...' : 'Escolher arquivo'}
            </span>
          </label>
        </div>
      )}
    </div>
  );
}

// ─────────── Proof Viewer ───────────
function ProofViewerDialog({ url, open, onClose }: { url: string | null; open: boolean; onClose: () => void }) {
  const isPdf = url?.toLowerCase().includes('.pdf');
  useEffect(() => {
    if (open && url && isPdf) {
      window.open(url, '_blank');
      onClose();
    }
  }, [open, url, isPdf, onClose]);
  if (!url || isPdf) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Comprovante</DialogTitle></DialogHeader>
        <img src={url} alt="Comprovante" className="max-h-[70vh] mx-auto" />
        <DialogFooter>
          <Button asChild variant="outline"><a href={url} download target="_blank" rel="noreferrer">Baixar</a></Button>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────── Main Page ───────────
export function TransferenciasPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState<'open' | 'history'>('open');
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [historyClientFilter, setHistoryClientFilter] = useState('');
  const [historyMethodFilter, setHistoryMethodFilter] = useState<'all' | PaymentMethod>('all');

  // Modals
  const [newOpen, setNewOpen] = useState(false);
  const [adjustFor, setAdjustFor] = useState<Transfer | null>(null);
  const [payFor, setPayFor] = useState<Transfer | null>(null);
  const [bulkPayOpen, setBulkPayOpen] = useState(false);
  const [proofView, setProofView] = useState<string | null>(null);

  // ── Load ──
  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('transfers')
      .select('*, clients:client_id(id,name,document_number), weighings:weighing_id(id,ticket_number)')
      .order('created_at', { ascending: false });
    if (dateFrom) q = q.gte('created_at', dateFrom);
    if (dateTo) q = q.lte('created_at', dateTo + 'T23:59:59');
    const { data, error } = await q;
    if (error) { toast.error('Erro ao carregar transferências'); console.error(error); setLoading(false); return; }
    const list = ((data as any[]) || []) as Transfer[];
    // Hydrate paid_by full names from profiles
    const ids = Array.from(new Set(list.map((t) => t.paid_by).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids);
      const map = new Map<string, string>((profs || []).map((p: any) => [p.user_id, p.full_name]));
      list.forEach((t) => { if (t.paid_by) t.paid_profile = { full_name: map.get(t.paid_by) || null }; });
    }
    setTransfers(list);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel('transfers-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transfers' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  // ── Derived ──
  const openItems = useMemo(
    () => transfers.filter((t) => t.status === 'em_aberto' || t.status === 'aprovado'),
    [transfers],
  );
  const historyItems = useMemo(() => {
    let xs = transfers.filter((t) => t.status === 'pago');
    if (historyClientFilter.trim()) {
      const q = historyClientFilter.toLowerCase();
      xs = xs.filter((t) =>
        (t.clients?.name || t.beneficiary_name || '').toLowerCase().includes(q),
      );
    }
    if (historyMethodFilter !== 'all') xs = xs.filter((t) => t.payment_method === historyMethodFilter);
    return xs;
  }, [transfers, historyClientFilter, historyMethodFilter]);

  const summary = useMemo(() => {
    const open = openItems.filter((t) => t.status === 'em_aberto');
    const appr = openItems.filter((t) => t.status === 'aprovado');
    return {
      openSum: open.reduce((s, t) => s + Number(t.amount), 0),
      apprSum: appr.reduce((s, t) => s + Number(t.amount), 0),
      count: openItems.length,
    };
  }, [openItems]);

  // ── Actions ──
  const supplierName = (t: Transfer) => t.clients?.name || t.beneficiary_name || '—';

  const approveOne = async (t: Transfer) => {
    if (!isAdmin) { toast.error('Apenas admin pode aprovar'); return; }
    const { error } = await supabase
      .from('transfers')
      .update({ status: 'aprovado', approved_at: new Date().toISOString(), approved_by: user!.id })
      .eq('id', t.id);
    if (error) { toast.error('Erro ao aprovar'); return; }
    await logAudit({ table: 'transfers', recordId: t.id, action: 'UPDATE', oldValue: { status: t.status }, newValue: { status: 'aprovado', audit_action: 'TRANSFER_APPROVED' } });
    toast.success('Aprovada');
    setSelected((s) => { const n = new Set(s); n.delete(t.id); return n; });
    load();
  };

  const approveBulk = async () => {
    if (!isAdmin) { toast.error('Apenas admin pode aprovar'); return; }
    const ids = Array.from(selected).filter((id) => {
      const t = transfers.find((x) => x.id === id);
      return t && t.status === 'em_aberto';
    });
    if (ids.length === 0) { toast.error('Nenhuma em aberto selecionada'); return; }
    const { error } = await supabase
      .from('transfers')
      .update({ status: 'aprovado', approved_at: new Date().toISOString(), approved_by: user!.id })
      .in('id', ids);
    if (error) { toast.error('Erro no lote'); return; }
    for (const id of ids) {
      await logAudit({ table: 'transfers', recordId: id, action: 'UPDATE', newValue: { status: 'aprovado', audit_action: 'TRANSFER_APPROVED_BULK' } });
    }
    toast.success(`${ids.length} aprovada(s)`);
    setSelected(new Set());
    load();
  };

  // ── Render ──
  return (
    <div className="p-3 space-y-3 text-[13px]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Transferências</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Label className="text-xs">De</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 w-[140px] text-xs" />
            <Label className="text-xs">Até</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 w-[140px] text-xs" />
          </div>
          <Button size="sm" onClick={() => setNewOpen(true)} className="gap-1">
            <Plus className="h-4 w-4" /> Nova Transferência Manual
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Total em aberto</div>
          <div className="text-lg font-bold text-yellow-600">{fmtBRL(summary.openSum)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Aprovado aguardando pagamento</div>
          <div className="text-lg font-bold text-green-600">{fmtBRL(summary.apprSum)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Pendentes</div>
          <div className="text-lg font-bold">{summary.count}</div>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="open">Em Aberto</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        {/* ── Em Aberto ── */}
        <TabsContent value="open" className="space-y-2">
          {selected.size > 0 && (
            <div className="flex items-center gap-2 bg-muted/40 border rounded p-2">
              <span className="text-xs">{selected.size} selecionada(s)</span>
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={approveBulk} className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Aprovar Selecionadas
                </Button>
              )}
              <Button size="sm" onClick={() => setBulkPayOpen(true)} className="gap-1">
                <DollarSign className="h-3 w-3" /> Marcar Pagas Selecionadas
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar</Button>
            </div>
          )}

          <div className="border rounded overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th className="p-1.5 w-8"></th>
                  <th className="p-1.5">Fornecedor</th>
                  <th className="p-1.5">Origem</th>
                  <th className="p-1.5 text-right">Valor Original</th>
                  <th className="p-1.5 text-right">Ajuste</th>
                  <th className="p-1.5 text-right">Valor Final</th>
                  <th className="p-1.5">Status</th>
                  <th className="p-1.5">Criada</th>
                  <th className="p-1.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>
                ) : openItems.length === 0 ? (
                  <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Nenhuma transferência em aberto</td></tr>
                ) : openItems.map((t) => (
                  <tr key={t.id} className="border-t hover:bg-muted/30">
                    <td className="p-1.5">
                      <Checkbox
                        checked={selected.has(t.id)}
                        onCheckedChange={(c) => {
                          setSelected((s) => {
                            const n = new Set(s);
                            if (c) n.add(t.id); else n.delete(t.id);
                            return n;
                          });
                        }}
                      />
                    </td>
                    <td className="p-1.5 font-medium">{supplierName(t)}</td>
                    <td className="p-1.5">
                      {t.origin === 'ticket' ? (
                        <Badge variant="outline">Ticket #{t.weighings?.ticket_number ?? '—'}</Badge>
                      ) : (
                        <Badge variant="outline">Manual</Badge>
                      )}
                    </td>
                    <td className="p-1.5 text-right font-mono">{fmtBRL(Number(t.original_amount))}</td>
                    <td className={`p-1.5 text-right font-mono ${Number(t.adjustment_amount) < 0 ? 'text-red-600' : Number(t.adjustment_amount) > 0 ? 'text-green-600' : ''}`}>
                      {Number(t.adjustment_amount) === 0 ? '—' : fmtBRL(Number(t.adjustment_amount))}
                    </td>
                    <td className="p-1.5 text-right font-mono font-semibold">{fmtBRL(Number(t.amount))}</td>
                    <td className="p-1.5"><StatusBadge status={t.status} /></td>
                    <td className="p-1.5">{fmtDate(t.created_at)}</td>
                    <td className="p-1.5 text-right whitespace-nowrap">
                      {isAdmin && t.status === 'em_aberto' && (
                        <Button size="sm" variant="outline" className="h-7 px-2 mr-1" onClick={() => approveOne(t)}>
                          <CheckCircle2 className="h-3 w-3 mr-1" />Aprovar
                        </Button>
                      )}
                      {isAdmin && (
                        <Button size="sm" variant="outline" className="h-7 px-2 mr-1" onClick={() => setAdjustFor(t)}>
                          <Edit3 className="h-3 w-3 mr-1" />Ajustar
                        </Button>
                      )}
                      {t.status === 'aprovado' && (
                        <Button size="sm" className="h-7 px-2" onClick={() => setPayFor(t)}>
                          <DollarSign className="h-3 w-3 mr-1" />Pagar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── Histórico ── */}
        <TabsContent value="history" className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Buscar fornecedor..."
              value={historyClientFilter}
              onChange={(e) => setHistoryClientFilter(e.target.value)}
              className="h-8 w-[220px] text-xs"
            />
            <Select value={historyMethodFilter} onValueChange={(v) => setHistoryMethodFilter(v as any)}>
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Forma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as formas</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="ted">TED</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto">
              <ExportButton items={historyItems} />
            </div>
          </div>

          <div className="border rounded overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th className="p-1.5">Fornecedor</th>
                  <th className="p-1.5">Origem</th>
                  <th className="p-1.5 text-right">Valor Pago</th>
                  <th className="p-1.5">Forma</th>
                  <th className="p-1.5">Data Pagamento</th>
                  <th className="p-1.5">Pago por</th>
                  <th className="p-1.5 text-center">Comprovante</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>
                ) : historyItems.length === 0 ? (
                  <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Nenhuma transferência paga</td></tr>
                ) : historyItems.map((t) => (
                  <tr key={t.id} className="border-t hover:bg-muted/30">
                    <td className="p-1.5 font-medium">{supplierName(t)}</td>
                    <td className="p-1.5">
                      {t.origin === 'ticket' ? `Ticket #${t.weighings?.ticket_number ?? '—'}` : 'Manual'}
                    </td>
                    <td className="p-1.5 text-right font-mono">{fmtBRL(Number(t.amount))}</td>
                    <td className="p-1.5">{t.payment_method ? PMLabel[t.payment_method] : '—'}</td>
                    <td className="p-1.5">{fmtDateTime(t.paid_at)}</td>
                    <td className="p-1.5">{t.paid_profile?.full_name || '—'}</td>
                    <td className="p-1.5 text-center">
                      {t.payment_proof_url ? (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setProofView(t.payment_proof_url)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <NewTransferDialog open={newOpen} onClose={() => setNewOpen(false)} onSaved={load} isAdmin={isAdmin} userId={user?.id} />
      <AdjustDialog transfer={adjustFor} onClose={() => setAdjustFor(null)} onSaved={load} isAdmin={isAdmin} />
      <PaymentDialog
        transfers={payFor ? [payFor] : []}
        open={!!payFor}
        onClose={() => setPayFor(null)}
        onSaved={() => { setPayFor(null); setSelected(new Set()); load(); }}
        userId={user?.id}
      />
      <PaymentDialog
        transfers={Array.from(selected).map((id) => transfers.find((t) => t.id === id)!).filter((t) => t && t.status !== 'pago')}
        open={bulkPayOpen}
        onClose={() => setBulkPayOpen(false)}
        onSaved={() => { setBulkPayOpen(false); setSelected(new Set()); load(); }}
        userId={user?.id}
      />
      <ProofViewerDialog url={proofView} open={!!proofView} onClose={() => setProofView(null)} />
    </div>
  );
}

// ─────────── New Manual Transfer ───────────
function NewTransferDialog({
  open, onClose, onSaved, isAdmin, userId,
}: { open: boolean; onClose: () => void; onSaved: () => void; isAdmin: boolean; userId?: string }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ClientLite[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientLite | null>(null);
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch(''); setResults([]); setSelectedClient(null);
      setName(''); setCpf(''); setAddress(''); setAmount(''); setDesc('');
    }
  }, [open]);

  useEffect(() => {
    if (!search.trim() || selectedClient) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('clients')
        .select('id,name,document_number')
        .or(`name.ilike.%${search}%,document_number.ilike.%${search}%`)
        .limit(8);
      setResults((data as any) || []);
    }, 250);
    return () => clearTimeout(t);
  }, [search, selectedClient]);

  const submit = async () => {
    if (!isAdmin) { toast.error('Apenas admin pode criar transferência manual'); return; }
    const amt = parseFloat(amount.replace(',', '.'));
    if (!amt || amt <= 0) { toast.error('Valor inválido'); return; }
    if (!desc.trim()) { toast.error('Motivo/descrição obrigatório'); return; }
    if (!selectedClient && (!name.trim() || !cpf.trim() || !address.trim())) {
      toast.error('Preencha os dados do beneficiário'); return;
    }
    setSaving(true);
    const payload: any = {
      origin: 'manual',
      status: 'em_aberto',
      amount: amt,
      original_amount: amt,
      description: desc,
      created_by: userId || null,
    };
    if (selectedClient) payload.client_id = selectedClient.id;
    else {
      payload.beneficiary_name = name;
      payload.beneficiary_cpf = cpf;
      payload.beneficiary_address = address;
    }
    const { data, error } = await supabase.from('transfers').insert(payload).select('id').single();
    setSaving(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    await logAudit({ table: 'transfers', recordId: data!.id, action: 'INSERT', newValue: { ...payload, audit_action: 'TRANSFER_MANUAL_CREATED' } });
    toast.success('Transferência criada');
    onSaved(); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Transferência Manual</DialogTitle>
          <DialogDescription>Apenas administradores podem salvar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Buscar cliente cadastrado</Label>
            {selectedClient ? (
              <div className="flex items-center gap-2 p-2 border rounded bg-muted/30">
                <span className="text-sm flex-1">{selectedClient.name} {selectedClient.document_number && `(${selectedClient.document_number})`}</span>
                <Button size="sm" variant="ghost" onClick={() => setSelectedClient(null)}><X className="h-3 w-3" /></Button>
              </div>
            ) : (
              <>
                <Input placeholder="Nome ou CPF/CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8" />
                {results.length > 0 && (
                  <div className="border rounded mt-1 max-h-40 overflow-y-auto bg-popover">
                    {results.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedClient(c); setSearch(''); }}
                        className="w-full text-left p-2 hover:bg-muted text-xs"
                      >
                        {c.name} {c.document_number && <span className="text-muted-foreground">({c.document_number})</span>}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {!selectedClient && (
            <>
              <div>
                <Label className="text-xs">Nome completo do beneficiário *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">CPF *</Label>
                <Input value={cpf} onChange={(e) => setCpf(e.target.value)} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Endereço completo *</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} className="h-8" />
              </div>
            </>
          )}

          <div>
            <Label className="text-xs">Valor (R$) *</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="h-8" />
          </div>
          <div>
            <Label className="text-xs">Motivo / Descrição *</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────── Adjust ───────────
function AdjustDialog({
  transfer, onClose, onSaved, isAdmin,
}: { transfer: Transfer | null; onClose: () => void; onSaved: () => void; isAdmin: boolean }) {
  const [newAmount, setNewAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (transfer) { setNewAmount(String(transfer.amount)); setReason(transfer.adjustment_reason || ''); }
    else { setNewAmount(''); setReason(''); }
  }, [transfer]);

  if (!transfer) return null;

  const submit = async () => {
    if (!isAdmin) { toast.error('Apenas admin'); return; }
    const v = parseFloat(newAmount.replace(',', '.'));
    if (!v || v <= 0) { toast.error('Valor inválido'); return; }
    if (!reason.trim()) { toast.error('Motivo obrigatório'); return; }
    setSaving(true);
    const adj = +(v - Number(transfer.original_amount)).toFixed(2);
    const { error } = await supabase
      .from('transfers')
      .update({ amount: v, adjustment_amount: adj, adjustment_reason: reason })
      .eq('id', transfer.id);
    setSaving(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    await logAudit({
      table: 'transfers', recordId: transfer.id, action: 'UPDATE',
      oldValue: { amount: transfer.amount, adjustment_amount: transfer.adjustment_amount },
      newValue: { amount: v, adjustment_amount: adj, adjustment_reason: reason, audit_action: 'TRANSFER_ADJUSTED' },
    });
    toast.success('Valor ajustado');
    onSaved(); onClose();
  };

  return (
    <Dialog open={!!transfer} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Ajustar Valor</DialogTitle></DialogHeader>
        <div className="space-y-3 text-xs">
          <div className="flex justify-between"><span>Valor original:</span><span className="font-mono">{fmtBRL(Number(transfer.original_amount))}</span></div>
          <div>
            <Label className="text-xs">Novo valor (R$) *</Label>
            <Input value={newAmount} onChange={(e) => setNewAmount(e.target.value)} inputMode="decimal" className="h-8" />
          </div>
          <div>
            <Label className="text-xs">Motivo do ajuste *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────── Payment (single or bulk) ───────────
function PaymentDialog({
  transfers, open, onClose, onSaved, userId,
}: { transfers: Transfer[]; open: boolean; onClose: () => void; onSaved: () => void; userId?: string }) {
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [proof, setProof] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setMethod('pix'); setDate(new Date().toISOString().slice(0, 10));
      setNotes(''); setProof(null);
    }
  }, [open]);

  const total = transfers.reduce((s, t) => s + Number(t.amount), 0);

  const submit = async () => {
    if (transfers.length === 0) { toast.error('Nenhuma transferência'); return; }
    setSaving(true);
    const paidAt = new Date(date + 'T12:00:00').toISOString();
    for (const t of transfers) {
      const { error } = await supabase
        .from('transfers')
        .update({
          status: 'pago',
          payment_method: method,
          paid_at: paidAt,
          paid_by: userId || null,
          payment_notes: notes || null,
          payment_proof_url: proof,
        })
        .eq('id', t.id);
      if (error) { toast.error(`Erro #${t.id.slice(0, 6)}: ${error.message}`); continue; }
      await logAudit({
        table: 'transfers', recordId: t.id, action: 'UPDATE',
        oldValue: { status: t.status },
        newValue: { status: 'pago', payment_method: method, paid_at: paidAt, audit_action: 'TRANSFER_PAID' },
      });
      // Debit on client account if linked
      if (t.client_id) {
        const ticketRef = t.weighings?.ticket_number ? `ticket #${t.weighings.ticket_number}` : 'manual';
        await supabase.from('client_transactions').insert({
          client_id: t.client_id,
          type: 'debito',
          description: `Pagamento ${ticketRef} — Transferência ${t.id.slice(0, 8)}`,
          amount: Number(t.amount),
          status: 'aberto',
          transaction_date: paidAt,
          value: Number(t.amount),
          created_by: userId || null,
        } as any);
      }
    }
    setSaving(false);
    toast.success(`${transfers.length} pagamento(s) confirmado(s)`);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar como Pago</DialogTitle>
          <DialogDescription>
            {transfers.length} transferência(s) — Total <strong>{fmtBRL(total)}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Forma de pagamento *</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="ted">TED</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Data do pagamento *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8" />
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div>
            <Label className="text-xs">Comprovante (imagem ou PDF)</Label>
            <ProofUploader value={proof} onChange={setProof} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Confirmando...' : 'Confirmar Pagamento'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────── Export ───────────
function ExportButton({ items }: { items: Transfer[] }) {
  const doExport = (fmt: ExportFormat) => {
    const headers = ['Fornecedor', 'Origem', 'Valor Pago', 'Forma', 'Data Pagamento', 'Pago por'];
    const rows = items.map((t) => [
      t.clients?.name || t.beneficiary_name || '—',
      t.origin === 'ticket' ? `Ticket #${t.weighings?.ticket_number ?? ''}` : 'Manual',
      Number(t.amount).toFixed(2),
      t.payment_method ? PMLabel[t.payment_method] : '',
      t.paid_at ? new Date(t.paid_at).toLocaleString('pt-BR') : '',
      t.paid_profile?.full_name || '',
    ]);
    exportTable(fmt, `transferencias_historico_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1"><Download className="h-3 w-3" /> Exportar</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => doExport('txt')}>TXT</DropdownMenuItem>
        <DropdownMenuItem onClick={() => doExport('csv')}>CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={() => doExport('xls')}>XLS</DropdownMenuItem>
        <DropdownMenuItem onClick={() => doExport('pdf')}>PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}