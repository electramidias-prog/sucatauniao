import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Plus, Search, Upload, Download, Users, Smartphone, SmartphoneOff,
  Edit, Trash2, Eye, X, FileSpreadsheet,
} from 'lucide-react';

interface Client {
  id: string;
  name: string;
  trade_name: string | null;
  document_type: string;
  document_number: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  address_city: string | null;
  address_state: string | null;
  client_type: string;
  status: string;
  portal_access_enabled: boolean;
  bank_name: string | null;
  pix_key: string | null;
  pix_key_type: string | null;
  source: string | null;
  notes: string | null;
  created_at: string;
}

const EMPTY_FORM = {
  name: '', trade_name: '', document_type: 'cpf', document_number: '',
  state_registration: '', municipal_registration: '',
  email: '', phone: '', whatsapp: '',
  address_street: '', address_number: '', address_complement: '',
  address_neighborhood: '', address_city: '', address_state: 'MG', address_zip: '',
  bank_name: '', bank_agency: '', bank_account: '',
  pix_key_type: '', pix_key: '',
  client_type: 'fornecedor', status: 'ativo', notes: '',
};

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
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name');
    if (!error && data) setClients(data as Client[]);
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const filtered = clients.filter((c) => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.document_number.includes(search) || (c.email || '').toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'todos' || c.client_type === filterType;
    const matchStatus = filterStatus === 'todos' || c.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const handleSave = async () => {
    if (!form.name || !form.document_number) {
      toast.error('Nome e CPF/CNPJ são obrigatórios');
      return;
    }

    const payload = { ...form, created_by: user?.id };

    if (editingId) {
      const { error } = await supabase.from('clients').update(payload).eq('id', editingId);
      if (error) { toast.error('Erro ao atualizar: ' + error.message); return; }
      toast.success('Cliente atualizado!');
    } else {
      const { error } = await supabase.from('clients').insert(payload);
      if (error) { toast.error('Erro ao cadastrar: ' + error.message); return; }
      toast.success('Cliente cadastrado!');
    }
    setDialogOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    fetchClients();
  };

  const handleEdit = (c: Client) => {
    setEditingId(c.id);
    setForm({
      name: c.name, trade_name: c.trade_name || '', document_type: c.document_type,
      document_number: c.document_number, state_registration: '', municipal_registration: '',
      email: c.email || '', phone: c.phone || '', whatsapp: c.whatsapp || '',
      address_street: '', address_number: '', address_complement: '',
      address_neighborhood: '', address_city: c.address_city || '', address_state: c.address_state || 'MG',
      address_zip: '', bank_name: c.bank_name || '', bank_agency: '', bank_account: '',
      pix_key_type: c.pix_key_type || '', pix_key: c.pix_key || '',
      client_type: c.client_type, status: c.status, notes: c.notes || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este cliente?')) return;
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Cliente excluído');
    fetchClients();
  };

  const exportCSV = () => {
    const headers = ['Nome', 'CPF/CNPJ', 'Tipo', 'Email', 'Telefone', 'Cidade', 'Status'];
    const rows = filtered.map((c) => [c.name, c.document_number, c.client_type, c.email || '', c.phone || '', c.address_city || '', c.status]);
    const csv = [headers, ...rows].map((r) => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `clientes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split('\n').filter(Boolean);
    if (lines.length < 2) { toast.error('Arquivo vazio ou inválido'); return; }

    const headers = lines[0].split(';').map((h) => h.trim().toLowerCase());
    const nameIdx = headers.findIndex((h) => h.includes('nome') || h.includes('razao'));
    const docIdx = headers.findIndex((h) => h.includes('cpf') || h.includes('cnpj') || h.includes('documento'));
    const emailIdx = headers.findIndex((h) => h.includes('email'));
    const phoneIdx = headers.findIndex((h) => h.includes('telefone') || h.includes('fone'));
    const cityIdx = headers.findIndex((h) => h.includes('cidade'));

    if (nameIdx === -1 || docIdx === -1) {
      toast.error('Colunas "Nome" e "CPF/CNPJ" são obrigatórias no arquivo');
      return;
    }

    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(';').map((c) => c.trim());
      const doc = cols[docIdx]?.replace(/[^0-9]/g, '');
      if (!cols[nameIdx] || !doc) continue;
      const { error } = await supabase.from('clients').insert({
        name: cols[nameIdx],
        document_number: doc,
        document_type: doc.length > 11 ? 'cnpj' : 'cpf',
        email: emailIdx >= 0 ? cols[emailIdx] || null : null,
        phone: phoneIdx >= 0 ? cols[phoneIdx] || null : null,
        address_city: cityIdx >= 0 ? cols[cityIdx] || null : null,
        source: 'import',
        created_by: user?.id,
      });
      if (!error) imported++;
    }
    toast.success(`${imported} clientes importados com sucesso!`);
    fetchClients();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const maskDoc = (doc: string) => {
    if (doc.length === 11) return `${doc.slice(0, 3)}.${doc.slice(3, 6)}.${doc.slice(6, 9)}-${doc.slice(9)}`;
    if (doc.length === 14) return `${doc.slice(0, 2)}.${doc.slice(2, 5)}.${doc.slice(5, 8)}/${doc.slice(8, 12)}-${doc.slice(12)}`;
    return doc;
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { ativo: 'badge-finalizado', inativo: 'badge-pendente', bloqueado: 'bg-destructive/15 text-destructive' };
    return <Badge className={map[s] || ''}>{s.charAt(0).toUpperCase() + s.slice(1)}</Badge>;
  };

  const typeBadge = (t: string) => {
    const labels: Record<string, string> = { fornecedor: 'Fornecedor', comprador: 'Comprador', ambos: 'Ambos' };
    return <Badge variant="outline" className="text-[10px]">{labels[t] || t}</Badge>;
  };

  const updateField = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Gestão de Clientes</h1>
          <p className="text-sm text-muted-foreground">{clients.length} clientes cadastrados</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1" /> Importar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5 mr-1" /> Exportar
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingId(null); setForm(EMPTY_FORM); } }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> Novo Cliente</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {/* Basic */}
                <div className="col-span-2">
                  <Label className="text-xs">Nome / Razão Social *</Label>
                  <Input value={form.name} onChange={(e) => updateField('name', e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Nome Fantasia</Label>
                  <Input value={form.trade_name} onChange={(e) => updateField('trade_name', e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Tipo Documento</Label>
                  <Select value={form.document_type} onValueChange={(v) => updateField('document_type', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">CPF/CNPJ *</Label>
                  <Input value={form.document_number} onChange={(e) => updateField('document_number', e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Tipo Cliente</Label>
                  <Select value={form.client_type} onValueChange={(v) => updateField('client_type', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fornecedor">Fornecedor</SelectItem>
                      <SelectItem value="comprador">Comprador</SelectItem>
                      <SelectItem value="ambos">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={form.status} onValueChange={(v) => updateField('status', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                      <SelectItem value="bloqueado">Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Contact */}
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input value={form.email} onChange={(e) => updateField('email', e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Telefone</Label>
                  <Input value={form.phone} onChange={(e) => updateField('phone', e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">WhatsApp</Label>
                  <Input value={form.whatsapp} onChange={(e) => updateField('whatsapp', e.target.value)} className="h-8 text-xs" />
                </div>
                {/* Address */}
                <div>
                  <Label className="text-xs">Cidade</Label>
                  <Input value={form.address_city} onChange={(e) => updateField('address_city', e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">UF</Label>
                  <Input value={form.address_state} onChange={(e) => updateField('address_state', e.target.value)} className="h-8 text-xs" maxLength={2} />
                </div>
                <div>
                  <Label className="text-xs">CEP</Label>
                  <Input value={form.address_zip} onChange={(e) => updateField('address_zip', e.target.value)} className="h-8 text-xs" />
                </div>
                {/* Bank */}
                <div>
                  <Label className="text-xs">Banco</Label>
                  <Input value={form.bank_name} onChange={(e) => updateField('bank_name', e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Tipo PIX</Label>
                  <Select value={form.pix_key_type} onValueChange={(v) => updateField('pix_key_type', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Telefone</SelectItem>
                      <SelectItem value="random">Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Chave PIX</Label>
                  <Input value={form.pix_key} onChange={(e) => updateField('pix_key', e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Observações</Label>
                  <Textarea value={form.notes} onChange={(e) => updateField('notes', e.target.value)} className="text-xs min-h-[60px]" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
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
          <div className="h-8 w-8 rounded bg-success/15 flex items-center justify-center text-success font-bold text-xs">A</div>
          <div><p className="text-lg font-bold">{clients.filter((c) => c.status === 'ativo').length}</p><p className="text-[10px] text-muted-foreground">Ativos</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <Smartphone className="h-8 w-8 text-info" />
          <div><p className="text-lg font-bold">{clients.filter((c) => c.portal_access_enabled).length}</p><p className="text-[10px] text-muted-foreground">Com App</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <FileSpreadsheet className="h-8 w-8 text-warning" />
          <div><p className="text-lg font-bold">{clients.filter((c) => c.source === 'import').length}</p><p className="text-[10px] text-muted-foreground">Importados</p></div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, CPF/CNPJ ou email..." className="pl-8 h-8 text-xs" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="fornecedor">Fornecedor</SelectItem>
            <SelectItem value="comprador">Comprador</SelectItem>
            <SelectItem value="ambos">Ambos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
            <SelectItem value="bloqueado">Bloqueado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full table-dense">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left font-medium">Nome</th>
                <th className="text-left font-medium">CPF/CNPJ</th>
                <th className="text-left font-medium">Tipo</th>
                <th className="text-left font-medium">Contato</th>
                <th className="text-left font-medium">Cidade</th>
                <th className="text-center font-medium">App</th>
                <th className="text-center font-medium">Status</th>
                <th className="text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground text-xs">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground text-xs">Nenhum cliente encontrado</td></tr>
              ) : filtered.map((c) => (
                <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="font-medium">{c.name}</td>
                  <td className="font-mono">{maskDoc(c.document_number)}</td>
                  <td>{typeBadge(c.client_type)}</td>
                  <td>{c.phone || c.email || '-'}</td>
                  <td>{c.address_city || '-'}</td>
                  <td className="text-center">
                    {c.portal_access_enabled ? (
                      <Smartphone className="h-3.5 w-3.5 text-success mx-auto" />
                    ) : (
                      <SmartphoneOff className="h-3.5 w-3.5 text-muted-foreground mx-auto" />
                    )}
                  </td>
                  <td className="text-center">{statusBadge(c.status)}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-0.5">
                      <button onClick={() => setViewClient(c)} className="p-1 rounded hover:bg-muted" title="Ver">
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => handleEdit(c)} className="p-1 rounded hover:bg-muted" title="Editar">
                        <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      {user?.role === 'admin' && (
                        <button onClick={() => handleDelete(c.id)} className="p-1 rounded hover:bg-muted" title="Excluir">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={!!viewClient} onOpenChange={() => setViewClient(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Detalhes do Cliente</DialogTitle></DialogHeader>
          {viewClient && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{viewClient.name}</span></div>
              <div><span className="text-muted-foreground">CPF/CNPJ:</span> <span className="font-mono">{maskDoc(viewClient.document_number)}</span></div>
              <div><span className="text-muted-foreground">Tipo:</span> {viewClient.client_type}</div>
              <div><span className="text-muted-foreground">Status:</span> {viewClient.status}</div>
              <div><span className="text-muted-foreground">Email:</span> {viewClient.email || '-'}</div>
              <div><span className="text-muted-foreground">Telefone:</span> {viewClient.phone || '-'}</div>
              <div><span className="text-muted-foreground">WhatsApp:</span> {viewClient.whatsapp || '-'}</div>
              <div><span className="text-muted-foreground">Cidade:</span> {viewClient.address_city || '-'}/{viewClient.address_state || '-'}</div>
              <div><span className="text-muted-foreground">Banco:</span> {viewClient.bank_name || '-'}</div>
              <div><span className="text-muted-foreground">PIX:</span> {viewClient.pix_key ? `${viewClient.pix_key_type}: ****${viewClient.pix_key.slice(-4)}` : '-'}</div>
              <div><span className="text-muted-foreground">App Ativo:</span> {viewClient.portal_access_enabled ? '✅ Sim' : '❌ Não'}</div>
              <div><span className="text-muted-foreground">Origem:</span> {viewClient.source}</div>
              {viewClient.notes && <div className="col-span-2"><span className="text-muted-foreground">Obs:</span> {viewClient.notes}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
