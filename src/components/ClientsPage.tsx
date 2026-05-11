import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Plus, Search, Upload, Download, Users, Smartphone, FileSpreadsheet,
  Edit, Trash2, Eye, AlertTriangle, Star, StarOff, Copy, Check,
  CreditCard, X, Ban, CheckCircle2,
} from 'lucide-react';
import { ImportMappingDialog } from '@/components/ImportMappingDialog';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { RefreshButton } from '@/components/RefreshButton';

// ─── Types ───
interface Client {
  id: string; name: string; trade_name: string | null; nickname: string | null;
  document_type: string; document_number: string; rg: string | null; birth_date: string | null;
  email: string | null; phone: string | null; whatsapp: string | null;
  address_street: string | null; address_number: string | null; address_complement: string | null;
  address_neighborhood: string | null; address_city: string | null; address_state: string | null; address_zip: string | null;
  client_type: string; status: string; operational_status: string;
  portal_access_enabled: boolean; vehicle_plate: string | null;
  bank_name: string | null; pix_key: string | null; pix_key_type: string | null;
  source: string | null; notes: string | null; negotiation_history: string | null;
  created_at: string;
}

interface PixKey {
  id: string; client_id: string; key_type: string; key_value: string;
  bank_name: string | null; holder_name: string | null; is_favorite: boolean; usage_count: number;
}

interface Weighing {
  id: string; client_id: string; ticket_number: number; vehicle_plate: string | null;
  material_type: string; gross_weight: number; tare_weight: number; net_weight: number;
  price_per_kg: number; total_value: number; status: string; settlement_id: string | null;
  created_at: string;
}

interface Transaction {
  id: string; client_id: string; type: string; description: string;
  amount: number; status: string; settlement_id: string | null; created_at: string;
}

interface Settlement {
  id: string; client_id: string; total_materials: number; total_deductions: number;
  net_amount: number; pix_key_display: string | null; holder_name: string | null;
  status: string; created_at: string;
}

const EMPTY_FORM = {
  name: '', trade_name: '', nickname: '', document_type: 'cpf', document_number: '',
  rg: '', birth_date: '', state_registration: '', municipal_registration: '',
  email: '', phone: '', whatsapp: '', vehicle_plate: '',
  address_street: '', address_number: '', address_complement: '',
  address_neighborhood: '', address_city: '', address_state: 'MG', address_zip: '',
  client_type: 'fornecedor', status: 'ativo', operational_status: 'normal',
  notes: '', negotiation_history: '',
};

const MATERIAL_LABELS: Record<string, string> = {
  mista: 'Mista', pesada: 'Pesada', limaria: 'Limaria', fundido: 'Fundido', amortecedor: 'Amortecedor',
  ferro: 'Ferro', cobre: 'Cobre', aluminio: 'Alumínio', inox: 'Inox', outros: 'Outros',
};

// ─── Helper fns ───
const formatDocument = (value: string, type: string): string => {
  const d = value.replace(/\D/g, '');
  if (type === 'cpf' && d.length >= 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`;
  if (type === 'cnpj' && d.length >= 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`;
  if (d.length === 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  return value;
};
const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

// ─── Input masks ───
const maskCPF = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};
const maskCNPJ = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};
const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  }
  return d
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
};
const maskDocument = (v: string, type: string) => (type === 'cnpj' ? maskCNPJ(v) : maskCPF(v));

// ═══════════════════════════════════════
// ─── MAIN COMPONENT ───
// ═══════════════════════════════════════
export function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('clients').select('*').order('name');
    if (data) setClients(data as unknown as Client[]);
    setLoading(false);
  }, []);

  const { refresh, isRefreshing, lastRefreshAt } = useAutoRefresh(fetchClients);

  const filtered = clients.filter((c) => {
    const s = search.toLowerCase();
    const matchSearch = !search ||
      c.name.toLowerCase().includes(s) ||
      (c.nickname || '').toLowerCase().includes(s) ||
      c.document_number.includes(search) ||
      (c.vehicle_plate || '').toLowerCase().includes(s);
    const matchType = filterType === 'todos' || c.client_type === filterType;
    const matchStatus = filterStatus === 'todos' || c.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  // ─── CRUD ───
  const handleSave = async () => {
    if (!form.name || !form.document_number) { toast.error('Nome e CPF/CNPJ são obrigatórios'); return; }
    const payload: Record<string, unknown> = { ...form, created_by: user?.id };
    // remove empty strings
    Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null; });
    payload.name = form.name;
    payload.document_number = form.document_number;

    if (editingId) {
      const { error } = await supabase.from('clients').update(payload as any).eq('id', editingId);
      if (error) { toast.error('Erro: ' + error.message); return; }
      toast.success('Cliente atualizado!');
    } else {
      const { error } = await supabase.from('clients').insert(payload as any);
      if (error) { toast.error('Erro: ' + error.message); return; }
      toast.success('Cliente cadastrado com sucesso!');
    }
    setDialogOpen(false); setEditingId(null); setForm(EMPTY_FORM); fetchClients();
  };

  const handleEdit = (c: Client) => {
    setEditingId(c.id);
    setForm({
      name: c.name, trade_name: c.trade_name || '', nickname: c.nickname || '',
      document_type: c.document_type, document_number: c.document_number,
      rg: c.rg || '', birth_date: c.birth_date || '',
      state_registration: '', municipal_registration: '',
      email: c.email || '', phone: c.phone || '', whatsapp: c.whatsapp || '',
      vehicle_plate: c.vehicle_plate || '',
      address_street: c.address_street || '', address_number: c.address_number || '',
      address_complement: c.address_complement || '', address_neighborhood: c.address_neighborhood || '',
      address_city: c.address_city || '', address_state: c.address_state || 'MG', address_zip: c.address_zip || '',
      client_type: c.client_type, status: c.status, operational_status: c.operational_status || 'normal',
      notes: c.notes || '', negotiation_history: c.negotiation_history || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este cliente?')) return;
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Excluído'); fetchClients();
  };

  const exportCSV = () => {
    const headers = ['Nome', 'Apelido', 'CPF/CNPJ', 'Placa', 'Tipo', 'Email', 'Telefone', 'Cidade', 'Status'];
    const rows = filtered.map(c => [c.name, c.nickname || '', c.document_number, c.vehicle_plate || '', c.client_type, c.email || '', c.phone || '', c.address_city || '', c.status]);
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `clientes_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  // Import is now handled by ImportMappingDialog

  const updateField = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  // ─── Status helpers ───
  const statusBadge = (s: string) => {
    const map: Record<string, string> = { ativo: 'badge-finalizado', inativo: 'badge-pendente', bloqueado: 'badge-bloqueado' };
    return <Badge className={map[s] || ''}>{s.charAt(0).toUpperCase() + s.slice(1)}</Badge>;
  };

  // ═══════════════════════════════
  // ─── RENDER ───
  // ═══════════════════════════════
  if (selectedClient) {
    return <ClientProfile client={selectedClient} onBack={() => { setSelectedClient(null); fetchClients(); }} userId={user?.id} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Gestão de Clientes</h1>
          <p className="text-sm text-muted-foreground">{clients.length} clientes cadastrados</p>
        </div>
        <div className="flex gap-2">
          <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} lastRefreshAt={lastRefreshAt} />
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-3.5 w-3.5 mr-1" /> Importar
          </Button>
          <ImportMappingDialog open={importOpen} onOpenChange={setImportOpen} onComplete={refresh} />
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5 mr-1" /> Exportar
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingId(null); setForm(EMPTY_FORM); } }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> Novo Cliente</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingId ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="col-span-2"><Label className="text-xs">Nome / Razão Social *</Label><Input value={form.name} onChange={e => updateField('name', e.target.value)} className="h-8 text-xs" /></div>
                <div><Label className="text-xs">Apelido</Label><Input value={form.nickname} onChange={e => updateField('nickname', e.target.value)} className="h-8 text-xs" /></div>
                <div><Label className="text-xs">Nome Fantasia</Label><Input value={form.trade_name} onChange={e => updateField('trade_name', e.target.value)} className="h-8 text-xs" /></div>
                <div><Label className="text-xs">Tipo Doc</Label>
                  <Select value={form.document_type} onValueChange={v => updateField('document_type', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cpf">CPF</SelectItem><SelectItem value="cnpj">CNPJ</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">CPF/CNPJ *</Label><Input value={form.document_number} onChange={e => updateField('document_number', maskDocument(e.target.value, form.document_type))} className="h-8 text-xs" placeholder={form.document_type === 'cnpj' ? '00.000.000/0000-00' : '000.000.000-00'} /></div>
                <div><Label className="text-xs">RG</Label><Input value={form.rg} onChange={e => updateField('rg', e.target.value)} className="h-8 text-xs" /></div>
                <div><Label className="text-xs">Data Nasc.</Label><Input type="date" value={form.birth_date} onChange={e => updateField('birth_date', e.target.value)} className="h-8 text-xs" /></div>
                <div><Label className="text-xs">Placa Veículo</Label><Input value={form.vehicle_plate} onChange={e => updateField('vehicle_plate', e.target.value)} className="h-8 text-xs" placeholder="ABC-1234" /></div>
                <div><Label className="text-xs">Tipo Cliente</Label>
                  <Select value={form.client_type} onValueChange={v => updateField('client_type', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fornecedor">Fornecedor</SelectItem>
                      <SelectItem value="pesagem_avulsa">Pesagem Avulsa</SelectItem>
                      <SelectItem value="coleta_agendada">Coleta Agendada</SelectItem>
                      <SelectItem value="envio">Envio</SelectItem>
                      <SelectItem value="doacao">Doação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Status</Label>
                  <Select value={form.status} onValueChange={v => updateField('status', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="inativo">Inativo</SelectItem><SelectItem value="bloqueado">Bloqueado</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => updateField('email', e.target.value)} className="h-8 text-xs" placeholder="email@exemplo.com" /></div>
                <div><Label className="text-xs">Telefone</Label><Input value={form.phone} onChange={e => updateField('phone', maskPhone(e.target.value))} className="h-8 text-xs" placeholder="(00) 00000-0000" /></div>
                <div><Label className="text-xs">WhatsApp</Label><Input value={form.whatsapp} onChange={e => updateField('whatsapp', maskPhone(e.target.value))} className="h-8 text-xs" placeholder="(00) 00000-0000" /></div>
                <div><Label className="text-xs">Cidade</Label><Input value={form.address_city} onChange={e => updateField('address_city', e.target.value)} className="h-8 text-xs" /></div>
                <div><Label className="text-xs">UF</Label><Input value={form.address_state} onChange={e => updateField('address_state', e.target.value)} className="h-8 text-xs" maxLength={2} /></div>
                <div><Label className="text-xs">CEP</Label><Input value={form.address_zip} onChange={e => updateField('address_zip', e.target.value)} className="h-8 text-xs" /></div>
                <div className="col-span-2"><Label className="text-xs">Observações</Label><Textarea value={form.notes} onChange={e => updateField('notes', e.target.value)} className="text-xs min-h-[50px]" /></div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => { setDialogOpen(false); setEditingId(null); setForm(EMPTY_FORM); }}>Cancelar</Button>
                <Button size="sm" onClick={handleSave}>{editingId ? 'Salvar' : 'Cadastrar'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3">
        <Card><CardContent className="p-3 flex items-center gap-2">
          <Users className="h-8 w-8 text-primary" />
          <div><p className="text-lg font-bold">{clients.length}</p><p className="text-[10px] text-muted-foreground">Total</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-accent/15 flex items-center justify-center text-accent font-bold text-xs">A</div>
          <div><p className="text-lg font-bold">{clients.filter(c => c.status === 'ativo').length}</p><p className="text-[10px] text-muted-foreground">Ativos</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <Ban className="h-8 w-8 text-destructive" />
          <div><p className="text-lg font-bold">{clients.filter(c => c.operational_status === 'bloqueado').length}</p><p className="text-[10px] text-muted-foreground">Bloqueados</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <Smartphone className="h-8 w-8 text-info" />
          <div><p className="text-lg font-bold">{clients.filter(c => c.portal_access_enabled).length}</p><p className="text-[10px] text-muted-foreground">Com App</p></div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, apelido, CPF/CNPJ ou placa..." className="pl-8 h-8 text-xs" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="fornecedor">Fornecedor</SelectItem>
            <SelectItem value="pesagem_avulsa">Pesagem Avulsa</SelectItem>
            <SelectItem value="coleta_agendada">Coleta Agendada</SelectItem>
            <SelectItem value="envio">Envio</SelectItem>
            <SelectItem value="doacao">Doação</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="inativo">Inativo</SelectItem><SelectItem value="bloqueado">Bloqueado</SelectItem></SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded border overflow-auto">
        <table className="w-full table-dense">
          <thead>
            <tr className="border-b bg-secondary">
              <th className="text-left text-muted-foreground font-medium">Status</th>
              <th className="text-left text-muted-foreground font-medium">Nome / Apelido</th>
              <th className="text-left text-muted-foreground font-medium">Documento</th>
              <th className="text-left text-muted-foreground font-medium">Placa</th>
              <th className="text-left text-muted-foreground font-medium">Cidade</th>
              <th className="text-center text-muted-foreground font-medium">App</th>
              <th className="text-right text-muted-foreground font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className={`border-b border-border/50 cursor-pointer hover:bg-muted/50 ${c.operational_status === 'bloqueado' ? 'row-bloqueado' : ''}`}
                onClick={() => setSelectedClient(c)}>
                <td>
                  <div className="flex items-center gap-1">
                    {c.operational_status === 'bloqueado' && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                    {statusBadge(c.status)}
                  </div>
                </td>
                <td className="font-medium">
                  {c.name}
                  {c.nickname && <span className="text-muted-foreground ml-1">({c.nickname})</span>}
                </td>
                <td className="font-mono">{formatDocument(c.document_number, c.document_type)}</td>
                <td className="font-mono">{c.vehicle_plate || '—'}</td>
                <td>{c.address_city || '—'}</td>
                <td className="text-center">
                  {c.portal_access_enabled ? <Smartphone className="h-3.5 w-3.5 text-accent mx-auto" /> : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="text-right" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedClient(c)}><Eye className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(c)}><Edit className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// ─── CLIENT PROFILE (360°) ───
// ═══════════════════════════════════════
function ClientProfile({ client, onBack, userId }: { client: Client; onBack: () => void; userId?: string }) {
  const [tab, setTab] = useState('cadastro');
  const [c, setC] = useState(client);
  const [pixKeys, setPixKeys] = useState<PixKey[]>([]);
  const [weighings, setWeighings] = useState<Weighing[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);

  const reload = useCallback(async () => {
    const [pix, w, t, s] = await Promise.all([
      supabase.from('client_pix_keys').select('*').eq('client_id', c.id).order('is_favorite', { ascending: false }),
      supabase.from('weighings').select('*').eq('client_id', c.id).order('created_at', { ascending: false }),
      supabase.from('client_transactions').select('*').eq('client_id', c.id).order('created_at', { ascending: false }),
      supabase.from('payment_settlements').select('*').eq('client_id', c.id).order('created_at', { ascending: false }),
    ]);
    if (pix.data) setPixKeys(pix.data as unknown as PixKey[]);
    if (w.data) setWeighings(w.data as unknown as Weighing[]);
    if (t.data) setTransactions(t.data as unknown as Transaction[]);
    if (s.data) setSettlements(s.data as unknown as Settlement[]);
  }, [c.id]);

  useEffect(() => { reload(); }, [reload]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>← Voltar</Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{c.name}</h1>
            {c.nickname && <span className="text-muted-foreground">({c.nickname})</span>}
            {c.operational_status === 'bloqueado' && <Badge className="badge-bloqueado"><AlertTriangle className="h-3 w-3 mr-1" />Bloqueado</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{formatDocument(c.document_number, c.document_type)} · {c.address_city || 'Sem cidade'}, {c.address_state || 'MG'}</p>
        </div>
        {c.portal_access_enabled && <Badge className="badge-finalizado"><Smartphone className="h-3 w-3 mr-1" />Portal Ativo</Badge>}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
          <TabsTrigger value="pix">Financeiro / PIX</TabsTrigger>
          <TabsTrigger value="extrato">Extrato Colocações</TabsTrigger>
          <TabsTrigger value="acerto">Conta Corrente / Acerto</TabsTrigger>
        </TabsList>

        {/* ─── TAB: CADASTRO ─── */}
        <TabsContent value="cadastro" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card><CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-primary">Dados Pessoais</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{c.name}</span></div>
                <div><span className="text-muted-foreground">Apelido:</span> <span className="font-medium">{c.nickname || '—'}</span></div>
                <div><span className="text-muted-foreground">CPF/CNPJ:</span> <span className="font-mono font-medium">{formatDocument(c.document_number, c.document_type)}</span></div>
                <div><span className="text-muted-foreground">RG:</span> <span className="font-medium">{c.rg || '—'}</span></div>
                <div><span className="text-muted-foreground">Nascimento:</span> <span className="font-medium">{c.birth_date ? fmtDate(c.birth_date) : '—'}</span></div>
                <div><span className="text-muted-foreground">Placa:</span> <span className="font-mono font-medium">{c.vehicle_plate || '—'}</span></div>
                <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{c.email || '—'}</span></div>
                <div><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{c.phone || '—'}</span></div>
                <div><span className="text-muted-foreground">WhatsApp:</span> <span className="font-medium">{c.whatsapp || '—'}</span></div>
                <div><span className="text-muted-foreground">Cliente desde:</span> <span className="font-medium">{c.created_at ? fmtDate(c.created_at) : '—'}</span></div>
              </div>
            </CardContent></Card>
            <Card><CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-primary">Localização</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="col-span-2"><span className="text-muted-foreground">Endereço:</span> <span className="font-medium">{[c.address_street, c.address_number, c.address_complement].filter(Boolean).join(', ') || '—'}</span></div>
                <div><span className="text-muted-foreground">Bairro:</span> <span className="font-medium">{c.address_neighborhood || '—'}</span></div>
                <div><span className="text-muted-foreground">Cidade:</span> <span className="font-medium">{c.address_city || '—'}</span></div>
                <div><span className="text-muted-foreground">UF:</span> <span className="font-medium">{c.address_state || '—'}</span></div>
                <div><span className="text-muted-foreground">CEP:</span> <span className="font-medium">{c.address_zip || '—'}</span></div>
              </div>
            </CardContent></Card>
          </div>
          <Card><CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-primary">Notas Operacionais</h3>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{c.notes || 'Nenhuma nota registrada.'}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-primary">Histórico de Negociações</h3>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{c.negotiation_history || 'Nenhum histórico registrado.'}</p>
          </CardContent></Card>
        </TabsContent>

        {/* ─── TAB: PIX ─── */}
        <TabsContent value="pix">
          <PixKeysTab clientId={c.id} pixKeys={pixKeys} onReload={reload} />
        </TabsContent>

        {/* ─── TAB: EXTRATO ─── */}
        <TabsContent value="extrato">
          <ExtratoTab weighings={weighings} />
        </TabsContent>

        {/* ─── TAB: ACERTO ─── */}
        <TabsContent value="acerto">
          <AcertoTab
            clientId={c.id}
            weighings={weighings}
            transactions={transactions}
            settlements={settlements}
            pixKeys={pixKeys}
            onReload={reload}
            userId={userId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════
// ─── PIX KEYS TAB ───
// ═══════════════════════════════════════
function PixKeysTab({ clientId, pixKeys, onReload }: { clientId: string; pixKeys: PixKey[]; onReload: () => void }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ key_type: 'cpf', key_value: '', bank_name: '', holder_name: '' });

  const addKey = async () => {
    if (!form.key_value || !form.holder_name) { toast.error('Chave e Titular são obrigatórios'); return; }
    const { error } = await supabase.from('client_pix_keys').insert({
      client_id: clientId, ...form, is_favorite: pixKeys.length === 0,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Chave PIX adicionada!');
    setAdding(false); setForm({ key_type: 'cpf', key_value: '', bank_name: '', holder_name: '' }); onReload();
  };

  const setFavorite = async (id: string) => {
    await supabase.from('client_pix_keys').update({ is_favorite: false }).eq('client_id', clientId);
    await supabase.from('client_pix_keys').update({ is_favorite: true }).eq('id', id);
    toast.success('Chave favorita atualizada'); onReload();
  };

  const deleteKey = async (id: string) => {
    if (!confirm('Excluir esta chave PIX?')) return;
    await supabase.from('client_pix_keys').delete().eq('id', id);
    toast.success('Removida'); onReload();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Chaves PIX ({pixKeys.length})</h3>
        <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Nova Chave</Button>
      </div>

      {adding && (
        <Card><CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Tipo</Label>
              <Select value={form.key_type} onValueChange={v => setForm(p => ({ ...p, key_type: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cpf">CPF</SelectItem><SelectItem value="cnpj">CNPJ</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="phone">Telefone</SelectItem><SelectItem value="random">Aleatória</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Chave *</Label><Input value={form.key_value} onChange={e => setForm(p => ({ ...p, key_value: e.target.value }))} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Banco</Label><Input value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Titular *</Label><Input value={form.holder_name} onChange={e => setForm(p => ({ ...p, holder_name: e.target.value }))} className="h-8 text-xs" /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button size="sm" onClick={addKey}>Salvar</Button>
          </div>
        </CardContent></Card>
      )}

      <div className="grid gap-3">
        {pixKeys.map(pk => (
          <Card key={pk.id} className={pk.is_favorite ? 'border-primary' : ''}>
            <CardContent className="p-4 flex items-center gap-4">
              <button onClick={() => setFavorite(pk.id)} className="shrink-0">
                {pk.is_favorite ? <Star className="h-5 w-5 text-primary fill-primary" /> : <StarOff className="h-5 w-5 text-muted-foreground" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{pk.holder_name || 'Sem titular'}</span>
                  {pk.is_favorite && <Badge className="badge-finalizado text-[10px]">Favorita</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pk.key_type.toUpperCase()} · <span className="font-mono">{pk.key_value}</span>
                  {pk.bank_name && ` · ${pk.bank_name}`}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Usada em {pk.usage_count} pagamento(s)</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteKey(pk.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {pixKeys.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma chave PIX cadastrada</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// ─── EXTRATO TAB ───
// ═══════════════════════════════════════
function ExtratoTab({ weighings }: { weighings: Weighing[] }) {
  const [filterMaterial, setFilterMaterial] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');

  const filtered = weighings.filter(w => {
    if (filterMaterial !== 'todos' && w.material_type !== filterMaterial) return false;
    if (filterStatus !== 'todos' && w.status !== filterStatus) return false;
    return true;
  });

  // Group by material for totals
  const totals = filtered.reduce((acc, w) => {
    const mat = w.material_type;
    if (!acc[mat]) acc[mat] = { peso: 0, valor: 0 };
    acc[mat].peso += Number(w.net_weight);
    acc[mat].valor += Number(w.total_value);
    return acc;
  }, {} as Record<string, { peso: number; valor: number }>);

  const pendingTotal = filtered.filter(w => w.status === 'pendente').reduce((s, w) => s + Number(w.total_value), 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <Select value={filterMaterial} onValueChange={setFilterMaterial}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Material" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Materiais</SelectItem>
            {Object.entries(MATERIAL_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="pago">Pago</SelectItem></SelectContent>
        </Select>
        <div className="ml-auto text-xs font-semibold text-primary">
          Pendente: {money(pendingTotal)}
        </div>
      </div>

      <div className="bg-card rounded border overflow-auto">
        <table className="w-full table-dense">
          <thead><tr className="border-b bg-secondary">
            <th className="text-left text-muted-foreground font-medium">Data</th>
            <th className="text-left text-muted-foreground font-medium">Material</th>
            <th className="text-right text-muted-foreground font-medium">Bruto (kg)</th>
            <th className="text-right text-muted-foreground font-medium">Tara (kg)</th>
            <th className="text-right text-muted-foreground font-medium">Líquido (kg)</th>
            <th className="text-right text-muted-foreground font-medium">R$/kg</th>
            <th className="text-right text-muted-foreground font-medium">Valor</th>
            <th className="text-center text-muted-foreground font-medium">Status</th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">Nenhuma pesagem encontrada</td></tr>
            ) : filtered.map(w => (
              <tr key={w.id} className="border-b border-border/50">
                <td>{fmtDate(w.created_at)}</td>
                <td>{MATERIAL_LABELS[w.material_type] || w.material_type}</td>
                <td className="text-right font-mono">{Number(w.gross_weight).toFixed(2)}</td>
                <td className="text-right font-mono">{Number(w.tare_weight).toFixed(2)}</td>
                <td className="text-right font-mono font-semibold">{Number(w.net_weight).toFixed(2)}</td>
                <td className="text-right font-mono">{Number(w.price_per_kg).toFixed(4)}</td>
                <td className="text-right font-mono font-semibold">{money(Number(w.total_value))}</td>
                <td className="text-center">
                  <Badge className={w.status === 'pago' ? 'badge-pago' : 'badge-pendente'}>{w.status === 'pago' ? 'Pago' : 'Pendente'}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals by material */}
      {Object.keys(totals).length > 0 && (
        <Card><CardContent className="p-3">
          <h4 className="text-xs font-semibold mb-2">Totalizadores por Material</h4>
          <div className="grid grid-cols-3 lg:grid-cols-5 gap-2">
            {Object.entries(totals).map(([mat, t]) => (
              <div key={mat} className="bg-secondary rounded p-2 text-center">
                <p className="text-[10px] text-muted-foreground">{MATERIAL_LABELS[mat] || mat}</p>
                <p className="text-sm font-bold">{t.peso.toFixed(2)} kg</p>
                <p className="text-[10px] font-mono text-muted-foreground">{money(t.valor)}</p>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// ─── ACERTO TAB ───
// ═══════════════════════════════════════
function AcertoTab({
  clientId, weighings, transactions, settlements, pixKeys, onReload, userId
}: {
  clientId: string; weighings: Weighing[]; transactions: Transaction[];
  settlements: Settlement[]; pixKeys: PixKey[]; onReload: () => void; userId?: string;
}) {
  const [newDebit, setNewDebit] = useState({ description: '', amount: '' });
  const [selectedDebits, setSelectedDebits] = useState<Set<string>>(new Set());
  const [settling, setSettling] = useState(false);
  const [copied, setCopied] = useState(false);

  const pendingWeighings = weighings.filter(w => w.status === 'pendente');
  const openDebits = transactions.filter(t => t.status === 'aberto');
  const totalMaterials = pendingWeighings.reduce((s, w) => s + Number(w.total_value), 0);
  const selectedDebitTotal = openDebits.filter(d => selectedDebits.has(d.id)).reduce((s, d) => s + Number(d.amount), 0);
  const netAmount = totalMaterials - selectedDebitTotal;
  const favoritePix = pixKeys.find(p => p.is_favorite);

  const addDebit = async () => {
    if (!newDebit.description || !newDebit.amount) { toast.error('Preencha descrição e valor'); return; }
    const { error } = await supabase.from('client_transactions').insert({
      client_id: clientId, type: 'debito', description: newDebit.description,
      amount: parseFloat(newDebit.amount), created_by: userId,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Débito registrado'); setNewDebit({ description: '', amount: '' }); onReload();
  };

  const toggleDebit = (id: string) => {
    setSelectedDebits(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const copyPixAndValue = () => {
    if (!favoritePix) return;
    navigator.clipboard.writeText(`${favoritePix.key_value} - ${money(netAmount)}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    toast.success('Chave e valor copiados!');
  };

  const confirmSettlement = async () => {
    if (pendingWeighings.length === 0) { toast.error('Nenhuma pesagem pendente'); return; }
    setSettling(true);
    try {
      // Create settlement
      const { data: settlement, error: sErr } = await supabase.from('payment_settlements').insert({
        client_id: clientId, total_materials: totalMaterials, total_deductions: selectedDebitTotal,
        net_amount: netAmount, pix_key_id: favoritePix?.id || null,
        pix_key_display: favoritePix?.key_value || null, holder_name: favoritePix?.holder_name || null,
        created_by: userId,
      }).select().single();
      if (sErr || !settlement) throw sErr;

      // Mark weighings as paid
      const wIds = pendingWeighings.map(w => w.id);
      await supabase.from('weighings').update({ status: 'pago', settlement_id: settlement.id }).in('id', wIds);

      // Liquidate selected debits
      if (selectedDebits.size > 0) {
        await supabase.from('client_transactions').update({ status: 'liquidado', settlement_id: settlement.id }).in('id', Array.from(selectedDebits));
      }

      // Increment PIX usage
      if (favoritePix) {
        await supabase.from('client_pix_keys').update({ usage_count: favoritePix.usage_count + 1 }).eq('id', favoritePix.id);
      }

      toast.success('Acerto confirmado com sucesso!');
      setSelectedDebits(new Set());
      onReload();
    } catch (err: any) {
      toast.error('Erro ao confirmar: ' + (err?.message || 'erro desconhecido'));
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* New debit */}
      <Card><CardContent className="p-4">
        <h3 className="text-sm font-semibold mb-3">Lançar Débito / Vale</h3>
        <div className="flex gap-2">
          <Input value={newDebit.description} onChange={e => setNewDebit(p => ({ ...p, description: e.target.value }))} placeholder="Descrição (ex: Vale, Compra Caminhão)" className="h-8 text-xs flex-1" />
          <Input type="number" value={newDebit.amount} onChange={e => setNewDebit(p => ({ ...p, amount: e.target.value }))} placeholder="Valor R$" className="h-8 text-xs w-32" />
          <Button size="sm" onClick={addDebit}><Plus className="h-3.5 w-3.5 mr-1" />Lançar</Button>
        </div>
      </CardContent></Card>

      {/* Settlement interface */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Pending weighings */}
        <Card><CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
            <CreditCard className="h-4 w-4 text-primary" /> Materiais Pendentes
          </h3>
          {pendingWeighings.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma pesagem pendente</p>
          ) : (
            <div className="space-y-1">
              {pendingWeighings.map(w => (
                <div key={w.id} className="flex justify-between text-xs py-1 border-b border-border/50">
                  <span>{fmtDate(w.created_at)} · {MATERIAL_LABELS[w.material_type] || w.material_type} · {Number(w.net_weight).toFixed(2)}kg</span>
                  <span className="font-mono font-semibold">{money(Number(w.total_value))}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold pt-2 text-primary">
                <span>SUBTOTAL MATERIAIS</span><span>{money(totalMaterials)}</span>
              </div>
            </div>
          )}
        </CardContent></Card>

        {/* Debits selection */}
        <Card><CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-2">Débitos / Vales em Aberto</h3>
          {openDebits.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum débito em aberto</p>
          ) : (
            <div className="space-y-1">
              {openDebits.map(d => (
                <label key={d.id} className="flex items-center gap-2 text-xs py-1 border-b border-border/50 cursor-pointer">
                  <Checkbox checked={selectedDebits.has(d.id)} onCheckedChange={() => toggleDebit(d.id)} />
                  <span className="flex-1">{d.description} ({fmtDate(d.created_at)})</span>
                  <span className="font-mono font-semibold text-destructive">{money(Number(d.amount))}</span>
                </label>
              ))}
              <div className="flex justify-between text-sm font-bold pt-2 text-destructive">
                <span>(-) DESCONTOS/VALES</span><span>{money(selectedDebitTotal)}</span>
              </div>
            </div>
          )}
        </CardContent></Card>
      </div>

      {/* Settlement summary */}
      <Card className="border-primary"><CardContent className="p-6">
        <div className="text-center space-y-3">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">SUBTOTAL MATERIAIS</p>
              <p className="text-lg font-bold text-accent">{money(totalMaterials)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">(-) DESCONTOS/VALES</p>
              <p className="text-lg font-bold text-destructive">{money(selectedDebitTotal)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">(=) VALOR LÍQUIDO A PAGAR</p>
              <p className="text-2xl font-bold text-primary">{money(netAmount)}</p>
            </div>
          </div>

          {favoritePix && (
            <div className="bg-secondary rounded-lg p-3 mt-3">
              <p className="text-xs text-muted-foreground">Chave PIX Favorita</p>
              <p className="text-sm font-bold mt-1">{favoritePix.holder_name}</p>
              <p className="text-xs font-mono text-muted-foreground">{favoritePix.key_type.toUpperCase()} · {favoritePix.key_value}</p>
            </div>
          )}

          <div className="flex gap-2 justify-center mt-4">
            <Button variant="outline" size="sm" onClick={copyPixAndValue} disabled={!favoritePix}>
              {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
              {copied ? 'Copiado!' : 'Copiar Chave e Valor'}
            </Button>
            <Button size="sm" onClick={confirmSettlement} disabled={settling || pendingWeighings.length === 0}>
              {settling ? 'Processando...' : '✓ Confirmar Pagamento'}
            </Button>
          </div>
        </div>
      </CardContent></Card>

      {/* Settlement history */}
      {settlements.length > 0 && (
        <Card><CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-2">Histórico de Acertos</h3>
          <table className="w-full table-dense">
            <thead><tr className="border-b bg-secondary">
              <th className="text-left text-muted-foreground font-medium">Data</th>
              <th className="text-right text-muted-foreground font-medium">Materiais</th>
              <th className="text-right text-muted-foreground font-medium">Descontos</th>
              <th className="text-right text-muted-foreground font-medium">Líquido</th>
              <th className="text-left text-muted-foreground font-medium">PIX / Titular</th>
            </tr></thead>
            <tbody>
              {settlements.map(s => (
                <tr key={s.id} className="border-b border-border/50">
                  <td>{fmtDate(s.created_at)}</td>
                  <td className="text-right font-mono">{money(Number(s.total_materials))}</td>
                  <td className="text-right font-mono text-destructive">{money(Number(s.total_deductions))}</td>
                  <td className="text-right font-mono font-semibold">{money(Number(s.net_amount))}</td>
                  <td className="text-xs">{s.holder_name || '—'} · {s.pix_key_display || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      )}
    </div>
  );
}
