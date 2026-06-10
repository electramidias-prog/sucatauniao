import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Wrench, ClipboardCheck, FileText, AlertTriangle, Trash2, Pencil, Search } from 'lucide-react';
import jsPDF from 'jspdf';

const EQUIPMENT_TYPES = ['Caminhão','Carreta','Empilhadeira','Garra Sucateira','Tesoura Jacaré','Balança Rodoviária','Prensa','Cisalha','Outros'];
const FREQUENCIES = ['diaria','semanal','mensal','trimestral','semestral','anual'];
const STATUSES = ['ativo','inativo','em_manutencao'];

type Equipment = any;
type Template = any;
type Record = any;
type Maintenance = any;
type Employee = { id: string; full_name: string; role_title?: string | null };

const daysUntil = (d?: string | null) => {
  if (!d) return null;
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  return diff;
};

function statusOf(eq: Equipment): { label: string; color: string } {
  const checks = [eq.nr12_expiry, eq.inmetro_expiry, eq.next_maintenance];
  const days = checks.map(daysUntil).filter((d) => d !== null) as number[];
  if (days.some((d) => d < 0)) return { label: '🔴 Crítico', color: 'bg-red-100 text-red-700 border-red-300' };
  if (days.some((d) => d <= 30)) return { label: '🟠 Atenção', color: 'bg-orange-100 text-orange-700 border-orange-300' };
  if (days.some((d) => d <= 90)) return { label: '🟡 Alerta', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' };
  return { label: '🟢 OK', color: 'bg-green-100 text-green-700 border-green-300' };
}

export function MaquinasPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canManage = !!user;
  const [tab, setTab] = useState('equipamentos');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [records, setRecords] = useState<Record[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');

  const [eqModal, setEqModal] = useState<{ open: boolean; data?: Equipment }>({ open: false });
  const [chkModal, setChkModal] = useState<{ open: boolean }>({ open: false });
  const [tmplModal, setTmplModal] = useState<{ open: boolean; data?: Template }>({ open: false });
  const [maintModal, setMaintModal] = useState<{ open: boolean }>({ open: false });

  const fetchAll = async () => {
    const [eq, tpl, rec, mt, emp] = await Promise.all([
      supabase.from('equipment').select('*').order('created_at', { ascending: false }),
      supabase.from('checklist_templates').select('*').order('created_at'),
      supabase.from('checklist_records').select('*').order('record_date', { ascending: false }).limit(200),
      supabase.from('maintenance_records').select('*').order('maintenance_date', { ascending: false }).limit(200),
      supabase.from('employees').select('id, full_name, role_title').eq('status', 'ativo').order('full_name'),
    ]);
    if (eq.data) setEquipment(eq.data);
    if (tpl.data) setTemplates(tpl.data);
    if (rec.data) setRecords(rec.data);
    if (mt.data) setMaintenance(mt.data);
    if (emp.data) setEmployees(emp.data);
  };

  const { refresh } = useAutoRefresh(fetchAll);

  const kpis = useMemo(() => {
    const ativos = equipment.filter((e) => e.status === 'ativo').length;
    let venc = 0, vencendo = 0;
    equipment.forEach((e) => {
      [e.nr12_expiry, e.inmetro_expiry].forEach((d) => {
        const u = daysUntil(d);
        if (u === null) return;
        if (u < 0) venc++;
        else if (u <= 30) vencendo++;
      });
    });
    const pendManut = equipment.filter((e) => {
      const u = daysUntil(e.next_maintenance);
      return u !== null && u <= 0;
    }).length;
    return { ativos, venc, vencendo, pendManut };
  }, [equipment]);

  const filteredEquipment = useMemo(
    () => equipment.filter((e) => !search || `${e.name} ${e.plate || ''} ${e.serial_number || ''}`.toLowerCase().includes(search.toLowerCase())),
    [equipment, search]
  );

  const monthMaintCost = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    return maintenance.filter((m) => (m.maintenance_date || '').startsWith(month)).reduce((s, m) => s + Number(m.cost || 0), 0);
  }, [maintenance]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wrench className="h-6 w-6" /> Máquinas e Laudos</h1>
          <p className="text-sm text-muted-foreground">Equipamentos, check-lists e manutenção preventiva.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="equipamentos">Equipamentos</TabsTrigger>
          <TabsTrigger value="checklists">Check-Lists</TabsTrigger>
          <TabsTrigger value="manutencao">Manutenção</TabsTrigger>
        </TabsList>

        {/* === EQUIPAMENTOS === */}
        <TabsContent value="equipamentos" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-muted-foreground">Equipamentos Ativos</div><div className="text-2xl font-bold">{kpis.ativos}</div></Card>
            <Card className="p-4 border-red-300"><div className="text-xs text-red-600">Laudos Vencidos</div><div className="text-2xl font-bold text-red-700">{kpis.venc}</div></Card>
            <Card className="p-4 border-yellow-300"><div className="text-xs text-yellow-700">Vencendo em 30 dias</div><div className="text-2xl font-bold text-yellow-700">{kpis.vencendo}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground">Manutenções Pendentes</div><div className="text-2xl font-bold">{kpis.pendManut}</div></Card>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, placa ou série..." className="pl-8" />
            </div>
            {canManage && <Button onClick={() => setEqModal({ open: true })}><Plus className="h-4 w-4 mr-1" />Novo Equipamento</Button>}
          </div>

          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase">
                <tr>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Foto</th>
                  <th className="p-2 text-left">Nome</th>
                  <th className="p-2 text-left">Tipo</th>
                  <th className="p-2 text-left">Placa/Série</th>
                  <th className="p-2 text-left">Responsável</th>
                  <th className="p-2 text-left">NR-12</th>
                  <th className="p-2 text-left">INMETRO</th>
                  <th className="p-2 text-left">Último Check-List</th>
                  <th className="p-2 text-left">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredEquipment.map((e) => {
                  const st = statusOf(e);
                  const resp = employees.find((emp) => emp.id === e.responsible_id);
                  return (
                    <tr key={e.id} className="border-t hover:bg-muted/30">
                      <td className="p-2"><Badge className={st.color} variant="outline">{st.label}</Badge></td>
                      <td className="p-2">{e.photo_url ? <img src={e.photo_url} className="h-8 w-8 rounded object-cover" alt="" /> : <div className="h-8 w-8 bg-muted rounded" />}</td>
                      <td className="p-2 font-medium">{e.name}</td>
                      <td className="p-2">{e.type}</td>
                      <td className="p-2 font-mono text-xs">{e.plate || e.serial_number || '-'}</td>
                      <td className="p-2">{resp?.full_name || '-'}</td>
                      <td className="p-2 text-xs">{e.nr12_expiry || '-'}</td>
                      <td className="p-2 text-xs">{e.inmetro_expiry || '-'}</td>
                      <td className="p-2 text-xs">{e.last_checklist_at ? new Date(e.last_checklist_at).toLocaleDateString('pt-BR') : '-'}</td>
                      <td className="p-2">
                        {canManage && <Button size="sm" variant="ghost" onClick={() => setEqModal({ open: true, data: e })}><Pencil className="h-3 w-3" /></Button>}
                      </td>
                    </tr>
                  );
                })}
                {filteredEquipment.length === 0 && (
                  <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Nenhum equipamento cadastrado.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* === CHECKLISTS === */}
        <TabsContent value="checklists" className="space-y-4">
          <Tabs defaultValue="modelos">
            <TabsList>
              <TabsTrigger value="modelos">Modelos</TabsTrigger>
              <TabsTrigger value="registros">Registros</TabsTrigger>
            </TabsList>
            <TabsContent value="modelos" className="space-y-3">
              <div className="flex justify-end">{canManage && <Button onClick={() => setTmplModal({ open: true })}><Plus className="h-4 w-4 mr-1" />Novo Modelo</Button>}</div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {templates.map((t) => (
                  <Card key={t.id} className="p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold">{t.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">{(t.equipment_types || []).join(', ')}</div>
                      </div>
                      {canManage && <Button size="sm" variant="ghost" onClick={() => setTmplModal({ open: true, data: t })}><Pencil className="h-3 w-3" /></Button>}
                    </div>
                    <ul className="mt-2 text-xs space-y-1 text-muted-foreground">
                      {(t.items || []).slice(0, 5).map((it: any, i: number) => <li key={i}>• {it.text}</li>)}
                      {(t.items || []).length > 5 && <li className="italic">+ {(t.items || []).length - 5} item(ns)…</li>}
                    </ul>
                  </Card>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="registros" className="space-y-3">
              <div className="flex justify-end"><Button onClick={() => setChkModal({ open: true })}><Plus className="h-4 w-4 mr-1" />Novo Check-List</Button></div>
              <Card className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-xs uppercase">
                    <tr>
                      <th className="p-2 text-left">Data/Hora</th>
                      <th className="p-2 text-left">Equipamento/Funcionário</th>
                      <th className="p-2 text-left">Modelo</th>
                      <th className="p-2 text-left">Cipista</th>
                      <th className="p-2 text-left">Resultado</th>
                      <th className="p-2 text-left">PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => {
                      const tpl = templates.find((t) => t.id === r.template_id);
                      const eq = equipment.find((e) => e.id === r.equipment_id);
                      const emp = employees.find((e) => e.id === r.employee_id);
                      const sup = employees.find((e) => e.id === r.supervisor_id);
                      const color = r.result === 'aprovado' ? 'bg-green-100 text-green-700' : r.result === 'reprovado' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700';
                      return (
                        <tr key={r.id} className="border-t">
                          <td className="p-2 text-xs">{new Date(r.record_date).toLocaleString('pt-BR')}</td>
                          <td className="p-2">{eq?.name || emp?.full_name || '-'}</td>
                          <td className="p-2 text-xs">{tpl?.name || '-'}</td>
                          <td className="p-2 text-xs">{sup?.full_name || '-'}</td>
                          <td className="p-2"><Badge className={color} variant="outline">{r.result}</Badge></td>
                          <td className="p-2">{r.pdf_url ? <a href={r.pdf_url} target="_blank" className="text-primary text-xs underline">Ver PDF</a> : '-'}</td>
                        </tr>
                      );
                    })}
                    {records.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum check-list registrado.</td></tr>}
                  </tbody>
                </table>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* === MANUTENÇÃO === */}
        <TabsContent value="manutencao" className="space-y-4">
          <div className="flex items-center justify-between">
            <Card className="p-4 inline-block">
              <div className="text-xs text-muted-foreground">Custo de Manutenção no Mês</div>
              <div className="text-2xl font-bold">R$ {monthMaintCost.toFixed(2)}</div>
            </Card>
            {canManage && <Button onClick={() => setMaintModal({ open: true })}><Plus className="h-4 w-4 mr-1" />Registrar Manutenção</Button>}
          </div>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase">
                <tr>
                  <th className="p-2 text-left">Data</th>
                  <th className="p-2 text-left">Equipamento</th>
                  <th className="p-2 text-left">Tipo</th>
                  <th className="p-2 text-left">Descrição</th>
                  <th className="p-2 text-left">Responsável</th>
                  <th className="p-2 text-right">Custo</th>
                  <th className="p-2 text-left">Próxima</th>
                </tr>
              </thead>
              <tbody>
                {maintenance.map((m) => {
                  const eq = equipment.find((e) => e.id === m.equipment_id);
                  const resp = employees.find((e) => e.id === m.responsible_id);
                  return (
                    <tr key={m.id} className="border-t">
                      <td className="p-2 text-xs">{m.maintenance_date}</td>
                      <td className="p-2">{eq?.name || '-'}</td>
                      <td className="p-2"><Badge variant="outline">{m.type}</Badge></td>
                      <td className="p-2 text-xs">{m.description}</td>
                      <td className="p-2 text-xs">{resp?.full_name || '-'}</td>
                      <td className="p-2 text-right">R$ {Number(m.cost || 0).toFixed(2)}</td>
                      <td className="p-2 text-xs">{m.next_maintenance || '-'}</td>
                    </tr>
                  );
                })}
                {maintenance.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma manutenção registrada.</td></tr>}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>

      {eqModal.open && <EquipmentModal data={eqModal.data} employees={employees} onClose={() => setEqModal({ open: false })} onSaved={() => { setEqModal({ open: false }); refresh(); }} />}
      {tmplModal.open && <TemplateModal data={tmplModal.data} onClose={() => setTmplModal({ open: false })} onSaved={() => { setTmplModal({ open: false }); refresh(); }} />}
      {chkModal.open && <ChecklistModal templates={templates} equipment={equipment} employees={employees} onClose={() => setChkModal({ open: false })} onSaved={() => { setChkModal({ open: false }); refresh(); }} />}
      {maintModal.open && <MaintenanceModal equipment={equipment} employees={employees} onClose={() => setMaintModal({ open: false })} onSaved={() => { setMaintModal({ open: false }); refresh(); }} />}
    </div>
  );
}

/* ============== MODALS ============== */

function EquipmentModal({ data, employees, onClose, onSaved }: any) {
  const { user } = useAuth();
  const [tab, setTab] = useState('id');
  const [form, setForm] = useState<any>(data || { type: 'Caminhão', status: 'ativo' });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    const payload = { ...form, created_by: form.id ? form.created_by : user?.id };
    const res = form.id
      ? await supabase.from('equipment').update(payload).eq('id', form.id)
      : await supabase.from('equipment').insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success('Equipamento salvo.');
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{form.id ? 'Editar' : 'Novo'} Equipamento</DialogTitle></DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="id">Identificação</TabsTrigger>
            <TabsTrigger value="laudos">Laudos</TabsTrigger>
            <TabsTrigger value="manut">Manutenção</TabsTrigger>
          </TabsList>
          <TabsContent value="id" className="grid grid-cols-2 gap-3 pt-2">
            <Field label="Nome *"><Input value={form.name || ''} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Tipo *">
              <Select value={form.type} onValueChange={(v) => set('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EQUIPMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Marca"><Input value={form.brand || ''} onChange={(e) => set('brand', e.target.value)} /></Field>
            <Field label="Modelo"><Input value={form.model || ''} onChange={(e) => set('model', e.target.value)} /></Field>
            <Field label="Ano"><Input type="number" value={form.year || ''} onChange={(e) => set('year', Number(e.target.value) || null)} /></Field>
            <Field label="Placa"><Input value={form.plate || ''} onChange={(e) => set('plate', e.target.value)} /></Field>
            <Field label="Nº Série"><Input value={form.serial_number || ''} onChange={(e) => set('serial_number', e.target.value)} /></Field>
            <Field label="Patrimônio"><Input value={form.patrimony || ''} onChange={(e) => set('patrimony', e.target.value)} /></Field>
            <Field label="Setor"><Input value={form.sector || ''} onChange={(e) => set('sector', e.target.value)} /></Field>
            <Field label="Responsável">
              <Select value={form.responsible_id || ''} onValueChange={(v) => set('responsible_id', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{employees.map((e: Employee) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="URL Foto" className="col-span-2"><Input value={form.photo_url || ''} onChange={(e) => set('photo_url', e.target.value)} placeholder="https://..." /></Field>
          </TabsContent>
          <TabsContent value="laudos" className="grid grid-cols-2 gap-3 pt-2">
            <Field label="NR-12 — Data Emissão"><Input type="date" value={form.nr12_date || ''} onChange={(e) => set('nr12_date', e.target.value || null)} /></Field>
            <Field label="NR-12 — Validade"><Input type="date" value={form.nr12_expiry || ''} onChange={(e) => set('nr12_expiry', e.target.value || null)} /></Field>
            <Field label="NR-12 — Técnico"><Input value={form.nr12_technician || ''} onChange={(e) => set('nr12_technician', e.target.value)} /></Field>
            <Field label="NR-12 — ART nº"><Input value={form.nr12_art || ''} onChange={(e) => set('nr12_art', e.target.value)} /></Field>
            <Field label="NR-12 — PDF URL" className="col-span-2"><Input value={form.nr12_pdf_url || ''} onChange={(e) => set('nr12_pdf_url', e.target.value)} /></Field>
            <Field label="INMETRO — Data"><Input type="date" value={form.inmetro_date || ''} onChange={(e) => set('inmetro_date', e.target.value || null)} /></Field>
            <Field label="INMETRO — Validade"><Input type="date" value={form.inmetro_expiry || ''} onChange={(e) => set('inmetro_expiry', e.target.value || null)} /></Field>
            <Field label="INMETRO — Certificado"><Input value={form.inmetro_cert || ''} onChange={(e) => set('inmetro_cert', e.target.value)} /></Field>
            <Field label="INMETRO — PDF URL"><Input value={form.inmetro_pdf_url || ''} onChange={(e) => set('inmetro_pdf_url', e.target.value)} /></Field>
          </TabsContent>
          <TabsContent value="manut" className="grid grid-cols-2 gap-3 pt-2">
            <Field label="Periodicidade">
              <Select value={form.maintenance_frequency || ''} onValueChange={(v) => set('maintenance_frequency', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Próxima Manutenção"><Input type="date" value={form.next_maintenance || ''} onChange={(e) => set('next_maintenance', e.target.value || null)} /></Field>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateModal({ data, onClose, onSaved }: any) {
  const { user } = useAuth();
  const [form, setForm] = useState<any>(data || { name: '', equipment_types: [], items: [{ text: '', type: 'SN' }] });
  const updateItem = (i: number, k: string, v: any) => {
    const items = [...form.items];
    items[i] = { ...items[i], [k]: v };
    setForm({ ...form, items });
  };
  const save = async () => {
    const payload = { ...form, created_by: user?.id };
    const res = form.id
      ? await supabase.from('checklist_templates').update(payload).eq('id', form.id)
      : await supabase.from('checklist_templates').insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success('Modelo salvo.');
    onSaved();
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{form.id ? 'Editar' : 'Novo'} Modelo de Check-List</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Nome"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Tipos de equipamento aplicáveis (separar por vírgula)">
            <Input value={(form.equipment_types || []).join(', ')} onChange={(e) => setForm({ ...form, equipment_types: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
          </Field>
          <div>
            <Label>Itens</Label>
            {form.items.map((it: any, i: number) => (
              <div key={i} className="flex gap-2 items-center mt-1">
                <Input value={it.text} onChange={(e) => updateItem(i, 'text', e.target.value)} placeholder="Texto do item" />
                <Select value={it.type} onValueChange={(v) => updateItem(i, 'type', v)}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SN">S/N</SelectItem>
                    <SelectItem value="SNNA">S/N/NA</SelectItem>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="number">Número</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, items: form.items.filter((_: any, j: number) => j !== i) })}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" className="mt-2" onClick={() => setForm({ ...form, items: [...form.items, { text: '', type: 'SN' }] })}><Plus className="h-3 w-3 mr-1" />Adicionar item</Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChecklistModal({ templates, equipment, employees, onClose, onSaved }: any) {
  const { user } = useAuth();
  const [templateId, setTemplateId] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [recordDate, setRecordDate] = useState(new Date().toISOString().slice(0, 16));
  const [responses, setResponses] = useState<any>({});
  const [observations, setObservations] = useState('');

  const tpl = templates.find((t: any) => t.id === templateId);
  const isFunc = tpl && (tpl.equipment_types || []).includes('Funcionário');

  const save = async () => {
    if (!tpl) return toast.error('Selecione um modelo.');
    // Determine result
    let result: 'aprovado' | 'reprovado' | 'pendente' = 'aprovado';
    for (const it of tpl.items) {
      const r = responses[it.text];
      if ((it.type === 'SN' || it.type === 'SNNA') && !r) { result = 'pendente'; break; }
      if (r === 'N') { result = 'reprovado'; break; }
      if (r === 'NA') result = 'pendente';
    }

    const ins = await supabase.from('checklist_records').insert({
      template_id: templateId,
      equipment_id: isFunc ? null : equipmentId || null,
      employee_id: isFunc ? employeeId || null : null,
      supervisor_id: supervisorId || null,
      record_date: new Date(recordDate).toISOString(),
      responses,
      observations,
      result,
      created_by: user?.id,
    }).select().single();
    if (ins.error) return toast.error(ins.error.message);

    // Update equipment last_checklist_at
    if (equipmentId) {
      await supabase.from('equipment').update({ last_checklist_at: new Date().toISOString() }).eq('id', equipmentId);
    }

    // Generate PDF
    try {
      const pdf = new jsPDF();
      pdf.setFontSize(14); pdf.text('PSA SUCATAS LTDA / SUCATA UNIÃO', 14, 14);
      pdf.setFontSize(9); pdf.text('CNPJ: 49.520.288/0001-25', 14, 20);
      pdf.setFontSize(12); pdf.text(`Check-List: ${tpl.name}`, 14, 30);
      pdf.setFontSize(9);
      const eq = equipment.find((e: any) => e.id === equipmentId);
      const emp = employees.find((e: any) => e.id === employeeId);
      const sup = employees.find((e: any) => e.id === supervisorId);
      pdf.text(`Data: ${new Date(recordDate).toLocaleString('pt-BR')}`, 14, 38);
      pdf.text(`${isFunc ? 'Funcionário' : 'Equipamento'}: ${eq?.name || emp?.full_name || '-'}`, 14, 44);
      pdf.text(`Cipista: ${sup?.full_name || '-'}`, 14, 50);
      pdf.text(`Resultado: ${result.toUpperCase()}`, 14, 56);
      let y = 66;
      tpl.items.forEach((it: any, i: number) => {
        const r = responses[it.text] ?? '-';
        pdf.text(`${i + 1}. ${it.text}: ${r}`, 14, y);
        y += 6;
      });
      if (observations) { pdf.text(`Obs: ${observations}`, 14, y + 4); }
      pdf.save(`checklist_${ins.data.id.slice(0, 8)}.pdf`);
    } catch (err) { console.error(err); }

    // If reprovado, alert in calendar
    if (result === 'reprovado' && user?.id) {
      const eqName = equipment.find((e: any) => e.id === equipmentId)?.name || employees.find((e: any) => e.id === employeeId)?.full_name || 'Item';
      await supabase.from('calendar_events').insert({
        title: `⚙️ Check-List REPROVADO: ${eqName}`,
        description: `Modelo: ${tpl.name}. Observações: ${observations}`,
        category: 'compliance',
        event_date: new Date().toISOString().slice(0, 10),
        reminder_days: 0,
        created_by: user.id,
      });
    }

    toast.success('Check-list salvo.');
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo Check-List</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Modelo">
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {tpl && (
            <>
              {isFunc ? (
                <Field label="Funcionário">
                  <Select value={employeeId} onValueChange={setEmployeeId}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              ) : (
                <Field label="Equipamento">
                  <Select value={equipmentId} onValueChange={setEquipmentId}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{equipment.filter((e: any) => (tpl.equipment_types || []).includes(e.type)).map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data/Hora"><Input type="datetime-local" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} /></Field>
                <Field label="Cipista">
                  <Select value={supervisorId} onValueChange={setSupervisorId}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="space-y-2">
                <Label>Itens</Label>
                {tpl.items.map((it: any, i: number) => (
                  <div key={i} className="border rounded p-2">
                    <div className="text-sm font-medium">{i + 1}. {it.text}</div>
                    {(it.type === 'SN' || it.type === 'SNNA') ? (
                      <div className="flex gap-2 mt-1">
                        {['S', 'N', ...(it.type === 'SNNA' ? ['NA'] : [])].map((opt) => (
                          <Button key={opt} size="sm" variant={responses[it.text] === opt ? 'default' : 'outline'} onClick={() => setResponses({ ...responses, [it.text]: opt })}>{opt}</Button>
                        ))}
                      </div>
                    ) : it.type === 'number' ? (
                      <Input type="number" value={responses[it.text] || ''} onChange={(e) => setResponses({ ...responses, [it.text]: e.target.value })} className="mt-1" />
                    ) : (
                      <Input value={responses[it.text] || ''} onChange={(e) => setResponses({ ...responses, [it.text]: e.target.value })} className="mt-1" />
                    )}
                  </div>
                ))}
              </div>
              <Field label="Observações do Operador"><Textarea value={observations} onChange={(e) => setObservations(e.target.value)} /></Field>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Salvar e Gerar PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MaintenanceModal({ equipment, employees, onClose, onSaved }: any) {
  const { user } = useAuth();
  const [form, setForm] = useState<any>({ type: 'preventiva', maintenance_date: new Date().toISOString().slice(0, 10), cost: 0 });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const save = async () => {
    if (!form.equipment_id) return toast.error('Selecione um equipamento.');
    const res = await supabase.from('maintenance_records').insert({ ...form, created_by: user?.id });
    if (res.error) return toast.error(res.error.message);
    if (form.next_maintenance) {
      await supabase.from('equipment').update({ next_maintenance: form.next_maintenance }).eq('id', form.equipment_id);
    }
    if (form.next_maintenance && user?.id) {
      const eqName = equipment.find((e: any) => e.id === form.equipment_id)?.name || '';
      await supabase.from('calendar_events').insert({
        title: `⚙️ Manutenção programada: ${eqName}`,
        description: form.description || '',
        category: 'manutencao',
        event_date: form.next_maintenance,
        reminder_days: 7,
        created_by: user.id,
      });
    }
    toast.success('Manutenção registrada.');
    onSaved();
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Registrar Manutenção</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Equipamento" className="col-span-2">
            <Select value={form.equipment_id || ''} onValueChange={(v) => set('equipment_id', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{equipment.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Data"><Input type="date" value={form.maintenance_date} onChange={(e) => set('maintenance_date', e.target.value)} /></Field>
          <Field label="Tipo">
            <Select value={form.type} onValueChange={(v) => set('type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="preventiva">Preventiva</SelectItem>
                <SelectItem value="corretiva">Corretiva</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Descrição" className="col-span-2"><Textarea value={form.description || ''} onChange={(e) => set('description', e.target.value)} /></Field>
          <Field label="Responsável">
            <Select value={form.responsible_id || ''} onValueChange={(v) => set('responsible_id', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Custo (R$)"><Input type="number" step="0.01" value={form.cost} onChange={(e) => set('cost', Number(e.target.value))} /></Field>
          <Field label="Peças substituídas" className="col-span-2"><Textarea value={form.parts_replaced || ''} onChange={(e) => set('parts_replaced', e.target.value)} /></Field>
          <Field label="Próxima manutenção"><Input type="date" value={form.next_maintenance || ''} onChange={(e) => set('next_maintenance', e.target.value || null)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: any) {
  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}