import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, PackagePlus, Search, FileDown, Trash2, Eraser, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';

type EPI = {
  id: string;
  name: string;
  category: string;
  ca_number: string | null;
  ca_expiry: string | null;
  quantity: number;
  min_quantity: number;
  supplier: string | null;
  unit_price: number | null;
  photo_url: string | null;
};

type Employee = { id: string; full_name: string; cpf: string | null; role_title: string | null; status: string };

type Delivery = {
  id: string;
  epi_id: string;
  employee_id: string;
  quantity: number;
  reason: string;
  size: string | null;
  signature_url: string | null;
  observation: string | null;
  receipt_pdf_url: string | null;
  created_at: string;
};

type Inflow = {
  id: string;
  epi_id: string;
  quantity: number;
  date: string;
  invoice: string | null;
  supplier: string | null;
  total_cost: number | null;
};

const CATEGORIES = ['Capacete', 'Botina', 'Luva', 'Óculos', 'Protetor Auricular', 'Máscara', 'Cinto', 'Avental', 'Uniforme', 'Outros'];
const REASONS = [
  { value: 'admissao', label: 'Admissão' },
  { value: 'reposicao', label: 'Reposição (perda)' },
  { value: 'troca_desgaste', label: 'Troca por desgaste' },
  { value: 'visitante', label: 'Visitante' },
  { value: 'outros', label: 'Outros' },
];
const SIZES = ['PP', 'P', 'M', 'G', 'GG', 'XGG', '37', '38', '39', '40', '41', '42', '43', '44'];

function statusBadge(epi: EPI): { label: string; className: string } {
  const expired = !!epi.ca_expiry && new Date(epi.ca_expiry) < new Date();
  if (expired) return { label: 'CA Vencido', className: 'bg-muted text-muted-foreground' };
  const q = Number(epi.quantity || 0);
  const m = Number(epi.min_quantity || 0);
  if (q <= m) return { label: 'Crítico', className: 'bg-destructive text-destructive-foreground' };
  if (q <= m * 2) return { label: 'Atenção', className: 'bg-yellow-400 text-black' };
  return { label: 'OK', className: 'bg-success text-success-foreground' };
}

function fmtMoney(n: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n || 0));
}
function fmtDate(d?: string | null) { return d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-BR') : '-'; }

/* ---------- Signature pad ---------- */
function SignaturePad({ value, onChange }: { value: string | null; onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value;
    }
  }, [value]);

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * ref.current!.width) / r.width, y: ((e.clientY - r.top) * ref.current!.height) / r.height };
  };
  const down = (e: React.PointerEvent) => { drawing.current = true; last.current = pos(e); (e.target as HTMLElement).setPointerCapture(e.pointerId); };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const ctx = ref.current!.getContext('2d')!;
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p;
  };
  const up = () => { drawing.current = false; last.current = null; if (ref.current) onChange(ref.current.toDataURL('image/png')); };
  const clear = () => {
    const c = ref.current!; const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    onChange(null);
  };

  return (
    <div className="space-y-1">
      <canvas
        ref={ref}
        width={500}
        height={140}
        className="w-full rounded border border-border touch-none bg-white"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
      />
      <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={clear}>
        <Eraser className="h-3 w-3" /> Limpar
      </Button>
    </div>
  );
}

/* ---------- PDF receipt ---------- */
async function generateReceiptPdf(opts: {
  epi: EPI; employee: Employee; quantity: number; reason: string; size: string | null; observation: string | null; signature: string | null; companyName?: string;
}): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text(opts.companyName || 'SUCATA UNIÃO', w / 2, 18, { align: 'center' });
  doc.setFontSize(11);
  doc.text('RECIBO DE ENTREGA DE EPI - NR-06', w / 2, 25, { align: 'center' });
  doc.setLineWidth(0.3); doc.line(15, 28, w - 15, 28);

  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  let y = 36;
  const row = (label: string, val: string) => { doc.setFont('helvetica', 'bold'); doc.text(label, 15, y); doc.setFont('helvetica', 'normal'); doc.text(val, 60, y); y += 6; };
  row('Funcionário:', opts.employee.full_name);
  row('CPF:', opts.employee.cpf || '-');
  row('Cargo:', opts.employee.role_title || '-');
  row('Data:', new Date().toLocaleDateString('pt-BR'));
  y += 2;
  doc.setFont('helvetica', 'bold'); doc.text('EPI ENTREGUE', 15, y); y += 5;
  doc.setFont('helvetica', 'normal');
  row('Item:', opts.epi.name);
  row('Categoria:', opts.epi.category);
  row('CA:', opts.epi.ca_number || '-');
  row('Quantidade:', String(opts.quantity));
  row('Tamanho:', opts.size || '-');
  row('Motivo:', REASONS.find((r) => r.value === opts.reason)?.label || opts.reason);
  if (opts.observation) row('Observação:', opts.observation);

  y += 4;
  const decl = 'Declaro ter recebido o(s) Equipamento(s) de Proteção Individual (EPI) acima, em perfeito estado de conservação, comprometendo-me a usá-lo(s) conforme as normas estabelecidas pela NR-06, conservá-lo(s) em boas condições, devolvê-lo(s) quando solicitado e comunicar qualquer dano ou extravio. Estou ciente das instruções de uso e responsabilidades.';
  const split = doc.splitTextToSize(decl, w - 30);
  doc.text(split, 15, y);
  y += split.length * 5 + 12;

  doc.line(40, y, w - 40, y); y += 5;
  doc.text('Assinatura do funcionário', w / 2, y, { align: 'center' });
  if (opts.signature) {
    try { doc.addImage(opts.signature, 'PNG', 70, y - 28, 70, 22); } catch {}
  }
  return doc.output('blob');
}

/* =================================================================== */
export function EPIsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canManage = !!user;

  const [epis, setEpis] = useState<EPI[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [inflows, setInflows] = useState<Inflow[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('estoque');

  const fetchAll = useCallback(async () => {
    const [e, em, d, i] = await Promise.all([
      supabase.from('epis').select('*').order('name'),
      supabase.from('employees').select('id, full_name, cpf, role_title, status').order('full_name'),
      supabase.from('epi_deliveries').select('*').order('created_at', { ascending: false }),
      supabase.from('epi_inflows').select('*').order('date', { ascending: false }),
    ]);
    setEpis((e.data as EPI[]) || []);
    setEmployees((em.data as Employee[]) || []);
    setDeliveries((d.data as Delivery[]) || []);
    setInflows((i.data as Inflow[]) || []);
  }, []);

  const { refresh, isRefreshing, lastRefreshAt } = useAutoRefresh(fetchAll);

  const filteredEpis = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return epis;
    return epis.filter((e) => [e.name, e.category, e.ca_number, e.supplier].filter(Boolean).some((s) => String(s).toLowerCase().includes(q)));
  }, [epis, search]);

  /* ---------- New EPI ---------- */
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState<any>({ name: '', category: 'Capacete', ca_number: '', ca_expiry: '', quantity: '0', min_quantity: '0', supplier: '', unit_price: '0' });
  const [newPhoto, setNewPhoto] = useState<File | null>(null);

  const uploadFile = async (file: File, prefix: string): Promise<string | null> => {
    const path = `${prefix}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const { error } = await supabase.storage.from('epi-files').upload(path, file);
    if (error) { toast.error('Falha ao enviar arquivo'); return null; }
    return path;
  };

  const submitNewEpi = async () => {
    if (!newForm.name.trim()) return toast.error('Informe o nome do EPI');
    let photo_url: string | null = null;
    if (newPhoto) photo_url = await uploadFile(newPhoto, 'photos');
    const { error } = await supabase.from('epis').insert({
      name: newForm.name.trim(),
      category: newForm.category,
      ca_number: newForm.ca_number || null,
      ca_expiry: newForm.ca_expiry || null,
      quantity: Number(newForm.quantity) || 0,
      min_quantity: Number(newForm.min_quantity) || 0,
      supplier: newForm.supplier || null,
      unit_price: Number(newForm.unit_price) || 0,
      photo_url,
      created_by: user?.id,
    });
    if (error) return toast.error('Erro ao criar EPI');
    toast.success('EPI cadastrado');
    setNewOpen(false);
    setNewForm({ name: '', category: 'Capacete', ca_number: '', ca_expiry: '', quantity: '0', min_quantity: '0', supplier: '', unit_price: '0' });
    setNewPhoto(null);
    refresh();
  };

  /* ---------- Inflow ---------- */
  const [inflowOpen, setInflowOpen] = useState(false);
  const [inflowForm, setInflowForm] = useState<any>({ epi_id: '', quantity: '', date: new Date().toISOString().slice(0, 10), invoice: '', supplier: '', total_cost: '' });

  const submitInflow = async () => {
    if (!inflowForm.epi_id || !inflowForm.quantity) return toast.error('Selecione o EPI e a quantidade');
    const { error } = await supabase.from('epi_inflows').insert({
      epi_id: inflowForm.epi_id,
      quantity: Number(inflowForm.quantity),
      date: inflowForm.date,
      invoice: inflowForm.invoice || null,
      supplier: inflowForm.supplier || null,
      total_cost: Number(inflowForm.total_cost) || 0,
      created_by: user?.id,
    });
    if (error) return toast.error('Erro ao registrar entrada');
    toast.success('Entrada registrada');
    setInflowOpen(false);
    setInflowForm({ epi_id: '', quantity: '', date: new Date().toISOString().slice(0, 10), invoice: '', supplier: '', total_cost: '' });
    refresh();
  };

  /* ---------- Delivery ---------- */
  const [delivOpen, setDelivOpen] = useState(false);
  const [delivForm, setDelivForm] = useState<any>({ employee_id: '', epi_id: '', quantity: '1', reason: 'reposicao', size: '', observation: '' });
  const [signature, setSignature] = useState<string | null>(null);
  const [physicalSig, setPhysicalSig] = useState(false);

  const ensureCalendarAlertForLowStock = async (epi: EPI, newQty: number) => {
    if (newQty > epi.min_quantity) return;
    if (!user) return;
    await supabase.from('calendar_events').insert({
      title: `🦺 Estoque baixo: ${epi.name}`,
      event_date: new Date().toISOString().slice(0, 10),
      category: 'epi_alerta',
      description: `Quantidade atual ${newQty} / mínimo ${epi.min_quantity}.`,
      created_by: user.id,
      reminder_days: 0,
    });
  };

  const submitDelivery = async () => {
    if (!delivForm.employee_id || !delivForm.epi_id) return toast.error('Selecione funcionário e EPI');
    const qty = Number(delivForm.quantity) || 0;
    if (qty <= 0) return toast.error('Quantidade inválida');
    const epi = epis.find((e) => e.id === delivForm.epi_id);
    const employee = employees.find((e) => e.id === delivForm.employee_id);
    if (!epi || !employee) return;
    if (qty > epi.quantity) return toast.error(`Estoque insuficiente (disponível: ${epi.quantity})`);

    let signature_url: string | null = null;
    if (signature && !physicalSig) {
      const blob = await (await fetch(signature)).blob();
      const file = new File([blob], `sig_${Date.now()}.png`, { type: 'image/png' });
      signature_url = await uploadFile(file, 'signatures');
    } else if (physicalSig) {
      signature_url = 'physical';
    }

    // Generate PDF receipt
    let receipt_pdf_url: string | null = null;
    try {
      const pdfBlob = await generateReceiptPdf({
        epi, employee, quantity: qty, reason: delivForm.reason, size: delivForm.size || null,
        observation: delivForm.observation || null,
        signature: physicalSig ? null : signature,
      });
      const file = new File([pdfBlob], `recibo_${Date.now()}.pdf`, { type: 'application/pdf' });
      receipt_pdf_url = await uploadFile(file, 'receipts');
    } catch (err) {
      console.error(err);
    }

    const { error } = await supabase.from('epi_deliveries').insert({
      epi_id: epi.id, employee_id: employee.id, quantity: qty, reason: delivForm.reason,
      size: delivForm.size || null, signature_url, observation: delivForm.observation || null,
      receipt_pdf_url, created_by: user?.id,
    });
    if (error) return toast.error('Erro ao registrar entrega');

    await ensureCalendarAlertForLowStock(epi, epi.quantity - qty);
    toast.success('Entrega registrada');
    setDelivOpen(false);
    setDelivForm({ employee_id: '', epi_id: '', quantity: '1', reason: 'reposicao', size: '', observation: '' });
    setSignature(null); setPhysicalSig(false);
    refresh();
  };

  const downloadReceipt = async (path: string) => {
    if (path === 'physical') return;
    const { data, error } = await supabase.storage.from('epi-files').createSignedUrl(path, 300);
    if (error || !data) return toast.error('Erro ao gerar link');
    window.open(data.signedUrl, '_blank');
  };

  const deleteDelivery = async (id: string) => {
    if (!confirm('Excluir esta entrega? O estoque NÃO será restituído automaticamente.')) return;
    const { error } = await supabase.from('epi_deliveries').delete().eq('id', id);
    if (error) return toast.error('Erro ao excluir');
    toast.success('Entrega excluída'); refresh();
  };

  /* ---------- Funcionários tab ---------- */
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const empDeliveries = useMemo(
    () => selectedEmp ? deliveries.filter((d) => d.employee_id === selectedEmp.id) : [],
    [deliveries, selectedEmp],
  );

  const printEmployeeFile = () => {
    if (!selectedEmp) return;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const w = doc.internal.pageSize.getWidth();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text('FICHA DE CONTROLE DE EPI', w / 2, 18, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Funcionário: ${selectedEmp.full_name}`, 15, 28);
    doc.text(`CPF: ${selectedEmp.cpf || '-'}`, 15, 34);
    doc.text(`Cargo: ${selectedEmp.role_title || '-'}`, 15, 40);
    doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, 15, 46);
    doc.line(15, 50, w - 15, 50);

    let y = 58;
    doc.setFont('helvetica', 'bold');
    doc.text('Data', 15, y); doc.text('EPI', 45, y); doc.text('Qtd', 110, y); doc.text('Tam', 125, y); doc.text('Motivo', 145, y);
    y += 4; doc.line(15, y, w - 15, y); y += 5;
    doc.setFont('helvetica', 'normal');
    empDeliveries.forEach((d) => {
      const epi = epis.find((e) => e.id === d.epi_id);
      doc.text(new Date(d.created_at).toLocaleDateString('pt-BR'), 15, y);
      doc.text((epi?.name || '-').slice(0, 30), 45, y);
      doc.text(String(d.quantity), 110, y);
      doc.text(d.size || '-', 125, y);
      doc.text((REASONS.find((r) => r.value === d.reason)?.label || d.reason).slice(0, 20), 145, y);
      y += 6;
      if (y > 280) { doc.addPage(); y = 20; }
    });
    doc.save(`ficha_epi_${selectedEmp.full_name.replace(/\s+/g, '_')}.pdf`);
  };

  const epiName = (id: string) => epis.find((e) => e.id === id)?.name || '-';
  const empName = (id: string) => employees.find((e) => e.id === id)?.full_name || '-';

  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">EPIs — Equipamentos de Proteção Individual</h1>
        <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} lastRefreshAt={lastRefreshAt} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="estoque">Estoque ({epis.length})</TabsTrigger>
          <TabsTrigger value="entregas">Entregas ({deliveries.length})</TabsTrigger>
          <TabsTrigger value="funcionarios">Funcionários</TabsTrigger>
        </TabsList>

        {/* ===== ABA 1 — ESTOQUE ===== */}
        <TabsContent value="estoque" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, categoria, CA..." className="h-8 pl-7" />
            </div>
            {canManage && (
              <>
                <Dialog open={inflowOpen} onOpenChange={setInflowOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="h-8 gap-1"><PackagePlus className="h-3.5 w-3.5" />Entrada de Estoque</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Entrada de Estoque</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label>EPI</Label>
                        <Select value={inflowForm.epi_id} onValueChange={(v) => setInflowForm({ ...inflowForm, epi_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>{epis.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label>Quantidade</Label><Input type="number" value={inflowForm.quantity} onChange={(e) => setInflowForm({ ...inflowForm, quantity: e.target.value })} /></div>
                        <div><Label>Data</Label><Input type="date" value={inflowForm.date} onChange={(e) => setInflowForm({ ...inflowForm, date: e.target.value })} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label>Nota Fiscal</Label><Input value={inflowForm.invoice} onChange={(e) => setInflowForm({ ...inflowForm, invoice: e.target.value })} /></div>
                        <div><Label>Fornecedor</Label><Input value={inflowForm.supplier} onChange={(e) => setInflowForm({ ...inflowForm, supplier: e.target.value })} /></div>
                      </div>
                      <div><Label>Custo Total (R$)</Label><Input type="number" step="0.01" value={inflowForm.total_cost} onChange={(e) => setInflowForm({ ...inflowForm, total_cost: e.target.value })} /></div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setInflowOpen(false)}>Cancelar</Button>
                      <Button onClick={submitInflow}>Registrar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={newOpen} onOpenChange={setNewOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="h-8 gap-1"><Plus className="h-3.5 w-3.5" />Novo EPI</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Novo EPI</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>Nome</Label><Input value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} /></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Categoria</Label>
                          <Select value={newForm.category} onValueChange={(v) => setNewForm({ ...newForm, category: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div><Label>CA</Label><Input value={newForm.ca_number} onChange={(e) => setNewForm({ ...newForm, ca_number: e.target.value })} /></div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div><Label>Validade CA</Label><Input type="date" value={newForm.ca_expiry} onChange={(e) => setNewForm({ ...newForm, ca_expiry: e.target.value })} /></div>
                        <div><Label>Qtd inicial</Label><Input type="number" value={newForm.quantity} onChange={(e) => setNewForm({ ...newForm, quantity: e.target.value })} /></div>
                        <div><Label>Qtd mínima</Label><Input type="number" value={newForm.min_quantity} onChange={(e) => setNewForm({ ...newForm, min_quantity: e.target.value })} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label>Fornecedor</Label><Input value={newForm.supplier} onChange={(e) => setNewForm({ ...newForm, supplier: e.target.value })} /></div>
                        <div><Label>Preço unit. (R$)</Label><Input type="number" step="0.01" value={newForm.unit_price} onChange={(e) => setNewForm({ ...newForm, unit_price: e.target.value })} /></div>
                      </div>
                      <div><Label>Foto</Label><Input type="file" accept="image/*" onChange={(e) => setNewPhoto(e.target.files?.[0] || null)} /></div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
                      <Button onClick={submitNewEpi}>Salvar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>

          <Card className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="p-2 w-12">Foto</th>
                  <th className="p-2">Nome</th>
                  <th className="p-2">Categoria</th>
                  <th className="p-2">CA</th>
                  <th className="p-2">Validade CA</th>
                  <th className="p-2 text-right">Qtd</th>
                  <th className="p-2 text-right">Mín</th>
                  <th className="p-2">Status</th>
                  <th className="p-2 text-right">Preço</th>
                </tr>
              </thead>
              <tbody>
                {filteredEpis.map((e) => {
                  const st = statusBadge(e);
                  return (
                    <tr key={e.id} className="border-t hover:bg-muted/20">
                      <td className="p-2">
                        {e.photo_url
                          ? <img src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/authenticated/epi-files/${e.photo_url}`} alt="" className="h-8 w-8 object-cover rounded" />
                          : <div className="h-8 w-8 rounded bg-muted" />}
                      </td>
                      <td className="p-2 font-medium">{e.name}</td>
                      <td className="p-2">{e.category}</td>
                      <td className="p-2">{e.ca_number || '-'}</td>
                      <td className="p-2">{fmtDate(e.ca_expiry)}</td>
                      <td className="p-2 text-right">{e.quantity}</td>
                      <td className="p-2 text-right">{e.min_quantity}</td>
                      <td className="p-2"><Badge className={cn(st.className, 'font-normal')}>{st.label}</Badge></td>
                      <td className="p-2 text-right">{fmtMoney(e.unit_price)}</td>
                    </tr>
                  );
                })}
                {filteredEpis.length === 0 && (
                  <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Nenhum EPI cadastrado.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* ===== ABA 2 — ENTREGAS ===== */}
        <TabsContent value="entregas" className="space-y-3">
          <div className="flex justify-end">
            {canManage && (
              <Dialog open={delivOpen} onOpenChange={setDelivOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-8 gap-1"><Plus className="h-3.5 w-3.5" />Registrar Entrega</Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl">
                  <DialogHeader><DialogTitle>Registrar Entrega de EPI</DialogTitle></DialogHeader>
                  <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Funcionário</Label>
                        <Select value={delivForm.employee_id} onValueChange={(v) => setDelivForm({ ...delivForm, employee_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>{employees.filter((e) => e.status === 'ativo').map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>EPI</Label>
                        <Select value={delivForm.epi_id} onValueChange={(v) => setDelivForm({ ...delivForm, epi_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>{epis.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} (estoque: {e.quantity})</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label>Quantidade</Label><Input type="number" value={delivForm.quantity} onChange={(e) => setDelivForm({ ...delivForm, quantity: e.target.value })} /></div>
                      <div>
                        <Label>Motivo</Label>
                        <Select value={delivForm.reason} onValueChange={(v) => setDelivForm({ ...delivForm, reason: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Tamanho</Label>
                        <Select value={delivForm.size} onValueChange={(v) => setDelivForm({ ...delivForm, size: v })}>
                          <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                          <SelectContent>{SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div><Label>Observação</Label><Textarea rows={2} value={delivForm.observation} onChange={(e) => setDelivForm({ ...delivForm, observation: e.target.value })} /></div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label>Assinatura digital</Label>
                        <label className="flex items-center gap-1.5 text-xs">
                          <input type="checkbox" checked={physicalSig} onChange={(e) => setPhysicalSig(e.target.checked)} />
                          Assinado fisicamente
                        </label>
                      </div>
                      {!physicalSig && <SignaturePad value={signature} onChange={setSignature} />}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDelivOpen(false)}>Cancelar</Button>
                    <Button onClick={submitDelivery}>Confirmar Entrega</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <Card className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="p-2">Data</th>
                  <th className="p-2">Funcionário</th>
                  <th className="p-2">EPI</th>
                  <th className="p-2 text-right">Qtd</th>
                  <th className="p-2">Motivo</th>
                  <th className="p-2">Tam</th>
                  <th className="p-2">Assinatura</th>
                  <th className="p-2">Recibo</th>
                  <th className="p-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id} className="border-t hover:bg-muted/20">
                    <td className="p-2">{new Date(d.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="p-2">{empName(d.employee_id)}</td>
                    <td className="p-2">{epiName(d.epi_id)}</td>
                    <td className="p-2 text-right">{d.quantity}</td>
                    <td className="p-2">{REASONS.find((r) => r.value === d.reason)?.label || d.reason}</td>
                    <td className="p-2">{d.size || '-'}</td>
                    <td className="p-2">{d.signature_url === 'physical' ? 'Física' : d.signature_url ? 'Digital' : '—'}</td>
                    <td className="p-2">
                      {d.receipt_pdf_url && d.receipt_pdf_url !== 'physical'
                        ? <Button size="sm" variant="ghost" className="h-6 gap-1 px-2" onClick={() => downloadReceipt(d.receipt_pdf_url!)}><FileDown className="h-3 w-3" />PDF</Button>
                        : '—'}
                    </td>
                    <td className="p-2">
                      {isAdmin && <Button size="sm" variant="ghost" className="h-6 px-2 text-destructive" onClick={() => deleteDelivery(d.id)}><Trash2 className="h-3 w-3" /></Button>}
                    </td>
                  </tr>
                ))}
                {deliveries.length === 0 && (
                  <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Nenhuma entrega registrada.</td></tr>
                )}
              </tbody>
            </table>
          </Card>

          {inflows.length > 0 && (
            <Card className="overflow-x-auto">
              <div className="p-2 text-xs font-semibold bg-muted/40">Entradas de estoque recentes</div>
              <table className="w-full text-xs">
                <thead className="bg-muted/20"><tr className="text-left"><th className="p-2">Data</th><th className="p-2">EPI</th><th className="p-2 text-right">Qtd</th><th className="p-2">NF</th><th className="p-2">Fornecedor</th><th className="p-2 text-right">Custo</th></tr></thead>
                <tbody>
                  {inflows.slice(0, 20).map((i) => (
                    <tr key={i.id} className="border-t">
                      <td className="p-2">{fmtDate(i.date)}</td>
                      <td className="p-2">{epiName(i.epi_id)}</td>
                      <td className="p-2 text-right">{i.quantity}</td>
                      <td className="p-2">{i.invoice || '-'}</td>
                      <td className="p-2">{i.supplier || '-'}</td>
                      <td className="p-2 text-right">{fmtMoney(i.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>

        {/* ===== ABA 3 — FUNCIONÁRIOS ===== */}
        <TabsContent value="funcionarios" className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card className="lg:col-span-1 overflow-y-auto max-h-[70vh]">
            <div className="p-2 text-xs font-semibold bg-muted/40">Funcionários ativos</div>
            <ul className="text-xs">
              {employees.filter((e) => e.status === 'ativo').map((emp) => {
                const count = deliveries.filter((d) => d.employee_id === emp.id).length;
                return (
                  <li key={emp.id}>
                    <button
                      onClick={() => setSelectedEmp(emp)}
                      className={cn('w-full text-left p-2 border-t hover:bg-muted/30 flex justify-between',
                        selectedEmp?.id === emp.id && 'bg-muted/40')}>
                      <span>{emp.full_name}</span>
                      <span className="text-muted-foreground">{count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card className="lg:col-span-2 p-3 space-y-3">
            {!selectedEmp && <p className="text-sm text-muted-foreground">Selecione um funcionário.</p>}
            {selectedEmp && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">{selectedEmp.full_name}</h2>
                    <p className="text-xs text-muted-foreground">{selectedEmp.role_title || '-'} • CPF {selectedEmp.cpf || '-'}</p>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1" onClick={printEmployeeFile}><FileText className="h-3.5 w-3.5" />Imprimir Ficha de EPI</Button>
                </div>
                <div>
                  <div className="text-xs font-semibold mb-1">Histórico (últimos 12 meses)</div>
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40"><tr className="text-left"><th className="p-2">Data</th><th className="p-2">EPI</th><th className="p-2">Qtd</th><th className="p-2">Tam</th><th className="p-2">Motivo</th></tr></thead>
                    <tbody>
                      {empDeliveries.filter((d) => new Date(d.created_at) >= new Date(Date.now() - 365 * 86400000)).map((d) => (
                        <tr key={d.id} className="border-t">
                          <td className="p-2">{new Date(d.created_at).toLocaleDateString('pt-BR')}</td>
                          <td className="p-2">{epiName(d.epi_id)}</td>
                          <td className="p-2">{d.quantity}</td>
                          <td className="p-2">{d.size || '-'}</td>
                          <td className="p-2">{REASONS.find((r) => r.value === d.reason)?.label || d.reason}</td>
                        </tr>
                      ))}
                      {empDeliveries.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">Sem entregas.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}