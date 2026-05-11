import { useCallback, useMemo, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { RefreshButton } from '@/components/RefreshButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Search, Users, ShieldAlert, HeartPulse, Cake, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type EmployeeStatus = 'ativo' | 'inativo' | 'afastado';

interface Employee {
  id: string;
  full_name: string;
  cpf: string | null;
  rg: string | null;
  birth_date: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  role_title: string | null;
  cbo_code: string | null;
  sector: string | null;
  admission_date: string | null;
  contract_type: string | null;
  base_salary: number | null;
  photo_url: string | null;
  status: EmployeeStatus;
}

interface Training {
  id: string;
  employee_id: string;
  nr_code: string;
  training_date: string | null;
  expiry_date: string | null;
  certificate_url: string | null;
  instructor: string | null;
}

interface Aso {
  id: string;
  employee_id: string;
  aso_type: string;
  aso_date: string | null;
  expiry_date: string | null;
  doctor_name: string | null;
  doctor_crm: string | null;
  document_url: string | null;
}

const NR_LIST = [
  { code: 'NR-06', label: 'NR-06 (EPI)' },
  { code: 'NR-10', label: 'NR-10 (Eletricidade)' },
  { code: 'NR-11', label: 'NR-11 (Transporte)' },
  { code: 'NR-12', label: 'NR-12 (Máquinas)' },
  { code: 'NR-23', label: 'NR-23 (Incêndio)' },
  { code: 'NR-33', label: 'NR-33 (Espaços Confinados)' },
  { code: 'NR-35', label: 'NR-35 (Trabalho em Altura)' },
];

const SECTORS = ['Pátio', 'Escritório', 'Balança', 'Frota', 'Manutenção'];
const CONTRACTS = ['CLT', 'PJ', 'Temporário'];
const ASO_TYPES = ['admissional', 'periodico', 'demissional', 'retorno'];

function maskCPF(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function diffDays(target: string | null) {
  if (!target) return Infinity;
  const t = new Date(target + 'T00:00:00').getTime();
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((t - now.getTime()) / 86400000);
}

function statusFromExpiries(items: { expiry_date: string | null }[]): 'green' | 'yellow' | 'red' | 'gray' {
  if (items.length === 0) return 'gray';
  let worst: 'green' | 'yellow' | 'red' = 'green';
  for (const i of items) {
    if (!i.expiry_date) continue;
    const d = diffDays(i.expiry_date);
    if (d < 0) return 'red';
    if (d <= 30 && worst !== 'red') worst = 'yellow';
  }
  return worst;
}

function StatusBadge({ status }: { status: 'green' | 'yellow' | 'red' | 'gray' }) {
  const map = {
    green: { cls: 'bg-success text-success-foreground', label: 'Em dia' },
    yellow: { cls: 'bg-yellow-400 text-black', label: 'Vence em breve' },
    red: { cls: 'bg-destructive text-destructive-foreground', label: 'Vencido' },
    gray: { cls: 'bg-muted text-muted-foreground', label: 'Sem registro' },
  } as const;
  const m = map[status];
  return <span className={cn('inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold', m.cls)}>{m.label}</span>;
}

const EMPTY_EMP = {
  full_name: '', cpf: '', rg: '', birth_date: '', phone: '', whatsapp: '', email: '', address: '',
  role_title: '', cbo_code: '', sector: '', admission_date: '', contract_type: 'CLT',
  base_salary: '', photo_url: '', status: 'ativo' as EmployeeStatus,
};

export function FuncionariosPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [asos, setAsos] = useState<Aso[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailEmpId, setDetailEmpId] = useState<string | null>(null);
  const [tab, setTab] = useState('pessoais');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState<typeof EMPTY_EMP>(EMPTY_EMP);
  const [formTrainings, setFormTrainings] = useState<Record<string, { training_date: string; expiry_date: string; certificate_url: string; instructor: string }>>({});
  const [formAso, setFormAso] = useState({ aso_type: 'admissional', aso_date: '', expiry_date: '', doctor_name: '', doctor_crm: '', document_url: '' });

  const fetchAll = useCallback(async () => {
    const [empRes, trRes, asoRes] = await Promise.all([
      supabase.from('employees').select('*').order('full_name'),
      supabase.from('employee_trainings').select('*'),
      supabase.from('employee_asos').select('*'),
    ]);
    if (empRes.error) toast.error('Erro ao carregar funcionários');
    setEmployees((empRes.data || []) as Employee[]);
    setTrainings((trRes.data || []) as Training[]);
    setAsos((asoRes.data || []) as Aso[]);
  }, []);

  const { refresh, isRefreshing, lastRefreshAt } = useAutoRefresh(fetchAll);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return employees;
    return employees.filter((e) =>
      e.full_name.toLowerCase().includes(s) ||
      (e.cpf || '').includes(s) ||
      (e.role_title || '').toLowerCase().includes(s)
    );
  }, [employees, search]);

  // KPIs
  const kpiActive = employees.filter((e) => e.status === 'ativo').length;
  const kpiNRsExpired = trainings.filter((t) => t.expiry_date && diffDays(t.expiry_date) < 0).length;
  const kpiAsoExpired = asos.filter((a) => a.expiry_date && diffDays(a.expiry_date) < 0).length;
  const currentMonth = new Date().getMonth();
  const kpiBirthdays = employees.filter((e) => e.birth_date && new Date(e.birth_date + 'T00:00:00').getMonth() === currentMonth).length;

  const trainingsByEmp = useMemo(() => {
    const m: Record<string, Training[]> = {};
    trainings.forEach((t) => { (m[t.employee_id] ||= []).push(t); });
    return m;
  }, [trainings]);

  const asosByEmp = useMemo(() => {
    const m: Record<string, Aso[]> = {};
    asos.forEach((a) => { (m[a.employee_id] ||= []).push(a); });
    return m;
  }, [asos]);

  const detailEmp = useMemo(() => employees.find((e) => e.id === detailEmpId) || null, [employees, detailEmpId]);

  const resetForm = () => {
    setForm(EMPTY_EMP);
    setFormTrainings({});
    setFormAso({ aso_type: 'admissional', aso_date: '', expiry_date: '', doctor_name: '', doctor_crm: '', document_url: '' });
    setTab('pessoais');
  };

  const uploadFile = async (file: File, prefix: string): Promise<string | null> => {
    const path = `${prefix}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await supabase.storage.from('employee-files').upload(path, file);
    if (error) { toast.error('Erro ao enviar arquivo'); return null; }
    const { data } = supabase.storage.from('employee-files').getPublicUrl(path);
    return data.publicUrl;
  };

  const handlePhotoSelect = async (file: File) => {
    setUploading(true);
    const url = await uploadFile(file, 'photos');
    setUploading(false);
    if (url) setForm((f) => ({ ...f, photo_url: url }));
  };

  const handleSave = async () => {
    if (!form.full_name.trim() || !user) {
      toast.error('Nome é obrigatório');
      return;
    }
    const payload = {
      full_name: form.full_name.trim(),
      cpf: form.cpf || null,
      rg: form.rg || null,
      birth_date: form.birth_date || null,
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
      email: form.email || null,
      address: form.address || null,
      role_title: form.role_title || null,
      cbo_code: form.cbo_code || null,
      sector: form.sector || null,
      admission_date: form.admission_date || null,
      contract_type: form.contract_type || null,
      base_salary: form.base_salary ? Number(form.base_salary) : null,
      photo_url: form.photo_url || null,
      status: form.status,
      created_by: user.id,
    };
    const { data: emp, error } = await supabase.from('employees').insert(payload).select().single();
    if (error || !emp) { toast.error('Erro ao salvar funcionário'); return; }

    // Trainings
    const trRows = Object.entries(formTrainings)
      .filter(([, v]) => v.training_date || v.expiry_date || v.certificate_url)
      .map(([code, v]) => ({
        employee_id: emp.id, nr_code: code,
        training_date: v.training_date || null,
        expiry_date: v.expiry_date || null,
        certificate_url: v.certificate_url || null,
        instructor: v.instructor || null,
      }));
    if (trRows.length) await supabase.from('employee_trainings').insert(trRows);

    // ASO
    if (formAso.aso_date || formAso.expiry_date) {
      await supabase.from('employee_asos').insert({
        employee_id: emp.id,
        aso_type: formAso.aso_type,
        aso_date: formAso.aso_date || null,
        expiry_date: formAso.expiry_date || null,
        doctor_name: formAso.doctor_name || null,
        doctor_crm: formAso.doctor_crm || null,
        document_url: formAso.document_url || null,
      });
    }

    toast.success('Funcionário cadastrado');
    setModalOpen(false);
    resetForm();
    refresh();
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Funcionários e NRs</h1>
        <div className="flex items-center gap-2">
          <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} lastRefreshAt={lastRefreshAt} />
          <Dialog open={modalOpen} onOpenChange={(o) => { setModalOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1"><Plus className="h-3.5 w-3.5" /> Novo Funcionário</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Novo Funcionário</DialogTitle></DialogHeader>
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="pessoais">Dados Pessoais</TabsTrigger>
                  <TabsTrigger value="profissionais">Profissionais</TabsTrigger>
                  <TabsTrigger value="nrs">NRs</TabsTrigger>
                  <TabsTrigger value="aso">ASO</TabsTrigger>
                </TabsList>

                <TabsContent value="pessoais" className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2"><Label>Nome completo *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                    <div><Label>CPF</Label><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })} /></div>
                    <div><Label>RG</Label><Input value={form.rg} onChange={(e) => setForm({ ...form, rg: e.target.value })} /></div>
                    <div><Label>Data de Nascimento</Label><Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></div>
                    <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                    <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                    <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
                    <div className="col-span-2"><Label>Endereço</Label><Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                  </div>
                </TabsContent>

                <TabsContent value="profissionais" className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Cargo</Label><Input value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} /></div>
                    <div><Label>CBO</Label><Input value={form.cbo_code} onChange={(e) => setForm({ ...form, cbo_code: e.target.value })} /></div>
                    <div>
                      <Label>Setor</Label>
                      <Select value={form.sector} onValueChange={(v) => setForm({ ...form, sector: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Tipo de Contrato</Label>
                      <Select value={form.contract_type} onValueChange={(v) => setForm({ ...form, contract_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{CONTRACTS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Data de Admissão</Label><Input type="date" value={form.admission_date} onChange={(e) => setForm({ ...form, admission_date: e.target.value })} /></div>
                    <div><Label>Salário Base (R$)</Label><Input type="number" step="0.01" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} /></div>
                    <div className="col-span-2">
                      <Label>Foto</Label>
                      <div className="flex items-center gap-2">
                        {form.photo_url && <img src={form.photo_url} alt="" className="h-12 w-12 rounded-full object-cover border" />}
                        <input ref={photoInputRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && handlePhotoSelect(e.target.files[0])} />
                        <Button type="button" size="sm" variant="outline" onClick={() => photoInputRef.current?.click()} disabled={uploading}>
                          <Upload className="h-3.5 w-3.5 mr-1" /> {uploading ? 'Enviando...' : 'Enviar foto'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="nrs" className="space-y-2">
                  <p className="text-xs text-muted-foreground">Preencha as NRs aplicáveis. Campos vazios serão ignorados.</p>
                  <div className="space-y-2">
                    {NR_LIST.map((nr) => {
                      const v = formTrainings[nr.code] || { training_date: '', expiry_date: '', certificate_url: '', instructor: '' };
                      const update = (patch: any) => setFormTrainings({ ...formTrainings, [nr.code]: { ...v, ...patch } });
                      return (
                        <div key={nr.code} className="border rounded p-2 space-y-1.5">
                          <div className="text-xs font-semibold">{nr.label}</div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div><Label className="text-[10px]">Treinamento</Label><Input type="date" value={v.training_date} onChange={(e) => update({ training_date: e.target.value })} /></div>
                            <div><Label className="text-[10px]">Validade</Label><Input type="date" value={v.expiry_date} onChange={(e) => update({ expiry_date: e.target.value })} /></div>
                            <div><Label className="text-[10px]">Instrutor</Label><Input value={v.instructor} onChange={(e) => update({ instructor: e.target.value })} /></div>
                            <div>
                              <Label className="text-[10px]">Certificado (PDF)</Label>
                              <Input type="file" accept="application/pdf" onChange={async (e) => {
                                const f = e.target.files?.[0]; if (!f) return;
                                const url = await uploadFile(f, `trainings/${nr.code}`);
                                if (url) update({ certificate_url: url });
                              }} />
                              {v.certificate_url && <a href={v.certificate_url} target="_blank" rel="noreferrer" className="text-[10px] text-primary underline">Ver arquivo</a>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="aso" className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Tipo</Label>
                      <Select value={formAso.aso_type} onValueChange={(v) => setFormAso({ ...formAso, aso_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ASO_TYPES.map((t) => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Data</Label><Input type="date" value={formAso.aso_date} onChange={(e) => setFormAso({ ...formAso, aso_date: e.target.value })} /></div>
                    <div><Label>Validade</Label><Input type="date" value={formAso.expiry_date} onChange={(e) => setFormAso({ ...formAso, expiry_date: e.target.value })} /></div>
                    <div><Label>Médico</Label><Input value={formAso.doctor_name} onChange={(e) => setFormAso({ ...formAso, doctor_name: e.target.value })} /></div>
                    <div><Label>CRM</Label><Input value={formAso.doctor_crm} onChange={(e) => setFormAso({ ...formAso, doctor_crm: e.target.value })} /></div>
                    <div className="col-span-2">
                      <Label>Documento (PDF)</Label>
                      <Input type="file" accept="application/pdf" onChange={async (e) => {
                        const f = e.target.files?.[0]; if (!f) return;
                        const url = await uploadFile(f, 'asos');
                        if (url) setFormAso({ ...formAso, document_url: url });
                      }} />
                      {formAso.document_url && <a href={formAso.document_url} target="_blank" rel="noreferrer" className="text-[10px] text-primary underline">Ver arquivo</a>}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setModalOpen(false); resetForm(); }}>Cancelar</Button>
                <Button onClick={handleSave}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="p-3 flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><div><div className="text-[10px] uppercase text-muted-foreground">Ativos</div><div className="text-lg font-bold">{kpiActive}</div></div></Card>
        <Card className="p-3 flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-destructive" /><div><div className="text-[10px] uppercase text-muted-foreground">NRs Vencidas</div><div className="text-lg font-bold">{kpiNRsExpired}</div></div></Card>
        <Card className="p-3 flex items-center gap-2"><HeartPulse className="h-5 w-5 text-destructive" /><div><div className="text-[10px] uppercase text-muted-foreground">ASOs Vencidos</div><div className="text-lg font-bold">{kpiAsoExpired}</div></div></Card>
        <Card className="p-3 flex items-center gap-2"><Cake className="h-5 w-5 text-pink-500" /><div><div className="text-[10px] uppercase text-muted-foreground">Aniversariantes do mês</div><div className="text-lg font-bold">{kpiBirthdays}</div></div></Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-7 h-8" placeholder="Buscar por nome, CPF ou cargo..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <Card className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-[11px]">
              <TableHead className="w-12">Foto</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Cargo (CBO)</TableHead>
              <TableHead>Admissão</TableHead>
              <TableHead>Status NRs</TableHead>
              <TableHead>Status ASO</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="w-16">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground text-xs">Nenhum funcionário cadastrado.</TableCell></TableRow>
            )}
            {filtered.map((e) => {
              const trs = trainingsByEmp[e.id] || [];
              const aso = asosByEmp[e.id] || [];
              return (
                <TableRow key={e.id} className="text-xs cursor-pointer hover:bg-muted/40" onClick={() => setDetailEmpId(e.id)}>
                  <TableCell>
                    {e.photo_url
                      ? <img src={e.photo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                      : <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">{e.full_name.charAt(0)}</div>}
                  </TableCell>
                  <TableCell className="font-medium">{e.full_name}<div className="text-[10px] text-muted-foreground">{e.sector || '—'}</div></TableCell>
                  <TableCell>{e.role_title || '—'}{e.cbo_code && <span className="text-muted-foreground"> ({e.cbo_code})</span>}</TableCell>
                  <TableCell>{e.admission_date ? new Date(e.admission_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                  <TableCell><StatusBadge status={statusFromExpiries(trs)} /></TableCell>
                  <TableCell><StatusBadge status={statusFromExpiries(aso)} /></TableCell>
                  <TableCell>{e.phone || '—'}</TableCell>
                  <TableCell onClick={(ev) => ev.stopPropagation()}>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => {
                      if (!confirm('Excluir funcionário?')) return;
                      const { error } = await supabase.from('employees').delete().eq('id', e.id);
                      if (error) toast.error('Apenas administradores podem excluir');
                      else { toast.success('Excluído'); refresh(); }
                    }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Detail panel */}
      <Sheet open={!!detailEmpId} onOpenChange={(o) => !o && setDetailEmpId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {detailEmp && (
            <>
              <SheetHeader>
                <SheetTitle>{detailEmp.full_name}</SheetTitle>
              </SheetHeader>
              <div className="space-y-3 mt-3 text-xs">
                <div className="flex items-center gap-3">
                  {detailEmp.photo_url
                    ? <img src={detailEmp.photo_url} alt="" className="h-16 w-16 rounded-full object-cover border" />
                    : <div className="h-16 w-16 rounded-full bg-muted" />}
                  <div>
                    <div className="font-bold">{detailEmp.role_title || '—'} {detailEmp.cbo_code && <span className="text-muted-foreground">({detailEmp.cbo_code})</span>}</div>
                    <div className="text-muted-foreground">{detailEmp.sector || '—'} • {detailEmp.contract_type || '—'}</div>
                    <Badge variant="outline" className="mt-1">{detailEmp.status}</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t pt-2">
                  <div><span className="text-muted-foreground">CPF:</span> {detailEmp.cpf || '—'}</div>
                  <div><span className="text-muted-foreground">RG:</span> {detailEmp.rg || '—'}</div>
                  <div><span className="text-muted-foreground">Nascimento:</span> {detailEmp.birth_date ? new Date(detailEmp.birth_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</div>
                  <div><span className="text-muted-foreground">Admissão:</span> {detailEmp.admission_date ? new Date(detailEmp.admission_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</div>
                  <div><span className="text-muted-foreground">Telefone:</span> {detailEmp.phone || '—'}</div>
                  <div><span className="text-muted-foreground">WhatsApp:</span> {detailEmp.whatsapp || '—'}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Email:</span> {detailEmp.email || '—'}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Endereço:</span> {detailEmp.address || '—'}</div>
                </div>

                <div className="border-t pt-2">
                  <h3 className="font-semibold mb-1">Histórico de NRs</h3>
                  {(trainingsByEmp[detailEmp.id] || []).length === 0 && <p className="text-muted-foreground">Nenhum treinamento.</p>}
                  {(trainingsByEmp[detailEmp.id] || []).map((t) => (
                    <div key={t.id} className="border rounded p-1.5 mb-1 flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">{t.nr_code}</Badge>
                      <span>{t.training_date || '—'} → {t.expiry_date || '—'}</span>
                      {t.expiry_date && <StatusBadge status={statusFromExpiries([t])} />}
                      {t.certificate_url && <a href={t.certificate_url} target="_blank" rel="noreferrer" className="text-primary underline ml-auto">Certificado</a>}
                    </div>
                  ))}
                </div>

                <div className="border-t pt-2">
                  <h3 className="font-semibold mb-1">Histórico de ASOs</h3>
                  {(asosByEmp[detailEmp.id] || []).length === 0 && <p className="text-muted-foreground">Nenhum ASO.</p>}
                  {(asosByEmp[detailEmp.id] || []).map((a) => (
                    <div key={a.id} className="border rounded p-1.5 mb-1 flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">{a.aso_type}</Badge>
                      <span>{a.aso_date || '—'} → {a.expiry_date || '—'}</span>
                      {a.expiry_date && <StatusBadge status={statusFromExpiries([a])} />}
                      {a.document_url && <a href={a.document_url} target="_blank" rel="noreferrer" className="text-primary underline ml-auto">Documento</a>}
                    </div>
                  ))}
                </div>

                <div className="border-t pt-2">
                  <h3 className="font-semibold mb-1">EPIs entregues</h3>
                  <p className="text-muted-foreground">Integração com módulo de EPIs em breve.</p>
                </div>

                <div className="border-t pt-2">
                  <h3 className="font-semibold mb-1">Faltas e observações</h3>
                  <p className="text-muted-foreground">Sem registros.</p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}