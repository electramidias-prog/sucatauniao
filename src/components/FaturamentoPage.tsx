import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, FileText, MessageCircle, Check, Copy, X, Download, Search } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '@/assets/logo-sucata-uniao.jpg';

interface InvoiceItem { id?: string; item_date: string; service_type: string; document_number: string; amount: number; }
interface Invoice {
  id: string; invoice_number: number; client_id: string;
  invoice_date: string; due_date: string; status: string; total_amount: number;
  observations: string | null; pdf_url: string | null; paid_at: string | null; created_at: string;
}
interface Client { id: string; name: string; document_number: string; document_type: string; phone: string | null; whatsapp: string | null; qr_code_url: string | null; state_registration: string | null; client_type: string; }

const money = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

const SERVICE_PRESETS = ['Transporte', 'Locação de Caçamba', 'Coleta de Sucata', 'Outros'];

const STATUS_STYLES: Record<string, string> = {
  rascunho: 'bg-muted text-muted-foreground',
  enviada: 'bg-info/15 text-info border-info/30',
  paga: 'bg-success/15 text-success border-success/30',
  vencida: 'bg-destructive/15 text-destructive border-destructive/30',
  cancelada: 'bg-muted text-muted-foreground line-through',
};

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    const blob = await r.blob();
    return await new Promise((res) => {
      const fr = new FileReader();
      fr.onloadend = () => res(fr.result as string);
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

export function FaturamentoPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('faturas');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [editing, setEditing] = useState<Invoice | null>(null);

  // form state
  const [form, setForm] = useState({
    client_id: '', invoice_date: today(), due_date: addDays(15),
    invoice_number: '', observations: '',
  });
  const [items, setItems] = useState<InvoiceItem[]>([
    { item_date: today(), service_type: 'Transporte', document_number: '', amount: 0 },
  ]);
  const [clientSearch, setClientSearch] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [iRes, cRes] = await Promise.all([
      supabase.from('invoices' as any).select('*').order('invoice_number', { ascending: false }),
      supabase.from('clients').select('id,name,document_number,document_type,phone,whatsapp,qr_code_url,state_registration,client_type').order('name'),
    ]);
    if (iRes.data) setInvoices(iRes.data as unknown as Invoice[]);
    if (cRes.data) setClients(cRes.data as unknown as Client[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-mark vencidas (client side display only)
  const enrichedInvoices = useMemo(() => invoices.map(i => {
    if (i.status === 'enviada' && i.due_date < today()) return { ...i, status: 'vencida' };
    return i;
  }), [invoices]);

  const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients]);

  // KPIs
  const monthStart = new Date(); monthStart.setDate(1);
  const ms = monthStart.toISOString().slice(0, 10);
  const kpis = useMemo(() => {
    const inMonth = enrichedInvoices.filter(i => i.invoice_date >= ms && i.status !== 'cancelada');
    const totalMes = inMonth.reduce((a, i) => a + Number(i.total_amount), 0);
    const abertas = enrichedInvoices.filter(i => ['rascunho', 'enviada'].includes(i.status)).reduce((a, i) => a + Number(i.total_amount), 0);
    const vencidas = enrichedInvoices.filter(i => i.status === 'vencida').reduce((a, i) => a + Number(i.total_amount), 0);
    const pagasMes = enrichedInvoices.filter(i => i.status === 'paga' && (i.paid_at || '').slice(0, 10) >= ms).reduce((a, i) => a + Number(i.total_amount), 0);
    return { totalMes, abertas, vencidas, pagasMes };
  }, [enrichedInvoices, ms]);

  const filtered = enrichedInvoices.filter(i => {
    const c = clientMap[i.client_id];
    const s = search.toLowerCase();
    const matchSearch = !s || (c?.name.toLowerCase().includes(s) || String(i.invoice_number).includes(s));
    const matchStatus = statusFilter === 'todos' || i.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const total = items.reduce((a, i) => a + (Number(i.amount) || 0), 0);

  // ─── Item handlers ───
  const addItem = () => setItems(p => [...p, { item_date: today(), service_type: 'Transporte', document_number: '', amount: 0 }]);
  const removeItem = (idx: number) => setItems(p => p.filter((_, i) => i !== idx));
  const updateItem = (idx: number, key: keyof InvoiceItem, val: any) =>
    setItems(p => p.map((it, i) => i === idx ? { ...it, [key]: val } : it));

  const resetForm = () => {
    setEditing(null);
    setForm({ client_id: '', invoice_date: today(), due_date: addDays(15), invoice_number: '', observations: '' });
    setItems([{ item_date: today(), service_type: 'Transporte', document_number: '', amount: 0 }]);
  };

  const openNew = () => { resetForm(); setTab('nova'); };

  const loadInvoiceForEdit = async (inv: Invoice) => {
    setEditing(inv);
    setForm({
      client_id: inv.client_id, invoice_date: inv.invoice_date, due_date: inv.due_date,
      invoice_number: String(inv.invoice_number), observations: inv.observations || '',
    });
    const { data } = await supabase.from('invoice_items' as any).select('*').eq('invoice_id', inv.id).order('created_at');
    setItems(((data as any) || []).map((d: any) => ({
      item_date: d.item_date || today(), service_type: d.service_type, document_number: d.document_number || '', amount: Number(d.amount),
    })));
    setTab('nova');
  };

  // ─── Save ───
  const saveInvoice = async (asDraft: boolean): Promise<Invoice | null> => {
    if (!form.client_id) { toast.error('Selecione um cliente'); return null; }
    if (!items.length || items.some(i => !i.service_type || !i.amount)) {
      toast.error('Preencha todos os itens (serviço e valor)'); return null;
    }
    const payload: any = {
      client_id: form.client_id,
      invoice_date: form.invoice_date,
      due_date: form.due_date,
      status: asDraft ? 'rascunho' : 'enviada',
      total_amount: total,
      observations: form.observations || null,
      created_by: user?.id,
    };
    if (form.invoice_number) payload.invoice_number = Number(form.invoice_number);

    let invoiceId: string;
    let saved: Invoice;
    if (editing) {
      const { data, error } = await supabase.from('invoices' as any).update(payload).eq('id', editing.id).select().single();
      if (error) { toast.error('Erro: ' + error.message); return null; }
      invoiceId = editing.id;
      saved = data as unknown as Invoice;
      await supabase.from('invoice_items' as any).delete().eq('invoice_id', invoiceId);
    } else {
      const { data, error } = await supabase.from('invoices' as any).insert(payload).select().single();
      if (error) { toast.error('Erro: ' + error.message); return null; }
      saved = data as unknown as Invoice;
      invoiceId = saved.id;
    }
    const itemsPayload = items.map(it => ({
      invoice_id: invoiceId, item_date: it.item_date || null,
      service_type: it.service_type, document_number: it.document_number || null, amount: Number(it.amount),
    }));
    await supabase.from('invoice_items' as any).insert(itemsPayload);
    toast.success(asDraft ? 'Rascunho salvo' : 'Fatura salva');
    await fetchAll();
    return saved;
  };

  // ─── PDF ───
  const generatePDF = async (inv: Invoice, itemsData: InvoiceItem[], client: Client): Promise<Blob> => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const logoData = await loadImageAsDataUrl(logoUrl);

    // Header
    if (logoData) {
      try { doc.addImage(logoData, 'JPEG', 12, 10, 22, 22); } catch {}
    }
    doc.setFontSize(8); doc.setTextColor(60);
    doc.text('Telefone: (31) 9 9653-5331', 38, 14);
    doc.text('www.sucatauniao.com/', 38, 18);
    doc.text('sucatauniaoadm@gmail.com', 38, 22);

    doc.setFontSize(22); doc.setTextColor(200, 30, 30); doc.setFont('helvetica', 'bold');
    doc.text('SUCATA UNIÃO', pageW - 12, 18, { align: 'right' });
    doc.setFontSize(16); doc.setTextColor(20);
    doc.text(`FATURA #${inv.invoice_number}`, pageW - 12, 28, { align: 'right' });

    doc.setDrawColor(200); doc.line(12, 36, pageW - 12, 36);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(30);
    doc.text(`DATA: ${fmtDate(inv.invoice_date)}`, 12, 44);
    doc.text(`VENCIMENTO: ${fmtDate(inv.due_date)}`, 12, 50);

    // Contratante
    doc.setFont('helvetica', 'bold'); doc.text('CONTRATANTE:', 12, 60);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text(client.name, 12, 67);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const docLabel = client.document_type === 'cnpj' ? 'CNPJ' : 'CPF';
    doc.text(`${docLabel}: ${client.document_number}${client.state_registration ? '  |  IE: ' + client.state_registration : ''}`, 12, 73);
    doc.text(`TEL.: ${client.phone || client.whatsapp || '—'}`, 12, 79);

    // Items table
    autoTable(doc, {
      startY: 86,
      head: [['DATA', 'SERVIÇO', 'N° DOCUMENTO', 'VALOR']],
      body: itemsData.map(it => [
        fmtDate(it.item_date), it.service_type, it.document_number || '—', money(Number(it.amount)),
      ]),
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [200, 30, 30], textColor: 255, halign: 'center' },
      columnStyles: { 0: { halign: 'center', cellWidth: 28 }, 3: { halign: 'right', cellWidth: 32 } },
      margin: { left: 12, right: 12 },
    });

    const afterY = (doc as any).lastAutoTable.finalY + 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text(`TOTAL: ${money(total || itemsData.reduce((a, i) => a + Number(i.amount), 0))}`, pageW - 12, afterY, { align: 'right' });

    // Payment info
    let y = afterY + 12;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('FORMA DE RECEBIMENTO:', 12, y); y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const lines = [
      'Transferência Bancária ou PIX:',
      'Banco: 077 - Banco Inter  /  Agência: 0001  /  Conta: 0406645647',
      'Chave Pix: CNPJ > 58.218.233/0001-45',
      'Titular da Conta: 58.218.233 ANA BEATRIZ GONCALVES PINTO',
      'Nome do Titular: Ana Beatriz Gonçalves Pinto',
      'CNPJ: 58.218.233/0001-45',
    ];
    lines.forEach(l => { doc.text(l, 12, y); y += 5; });

    // QR Code
    if (client.qr_code_url) {
      const qrData = await loadImageAsDataUrl(client.qr_code_url);
      if (qrData) {
        try { doc.addImage(qrData, 'PNG', pageW - 50, afterY + 8, 38, 38); } catch {}
      }
    }

    y += 6;
    doc.setFont('helvetica', 'bold'); doc.text('Termos & Condições:', 12, y); y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('Cadastre-se em https://www.sucatauniao.com/agendamentos', 12, y); y += 5;
    doc.text('E veja nossos termos, normas e regulamentos.', 12, y);

    // Watermark logo at bottom
    if (logoData) {
      try {
        const w = 80;
        // @ts-ignore
        doc.saveGraphicsState && doc.saveGraphicsState();
        // @ts-ignore
        doc.setGState && doc.setGState(new (jsPDF as any).GState({ opacity: 0.08 }));
        doc.addImage(logoData, 'JPEG', (pageW - w) / 2, 240, w, w * 0.6);
        // @ts-ignore
        doc.restoreGraphicsState && doc.restoreGraphicsState();
      } catch {}
    }

    return doc.output('blob');
  };

  const handleGenerateAndSend = async () => {
    const saved = await saveInvoice(false);
    if (!saved) return;
    const client = clientMap[saved.client_id];
    if (!client) return;
    const blob = await generatePDF(saved, items, client);
    const path = `${saved.id}.pdf`;
    const { error } = await supabase.storage.from('invoices').upload(path, blob, { upsert: true, contentType: 'application/pdf' });
    if (error) { toast.error('Erro upload PDF: ' + error.message); return; }
    const { data: signed } = await supabase.storage.from('invoices').createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    await supabase.from('invoices' as any).update({ pdf_url: signed?.signedUrl ?? path }).eq('id', saved.id);
    // Download local
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `fatura-${saved.invoice_number}.pdf`; a.click();
    toast.success('PDF gerado e salvo');
    await fetchAll();
    setTab('faturas');
    resetForm();
  };

  const viewPDF = async (inv: Invoice) => {
    if (inv.pdf_url) { window.open(inv.pdf_url, '_blank'); return; }
    const { data: itemsData } = await supabase.from('invoice_items' as any).select('*').eq('invoice_id', inv.id).order('created_at');
    const client = clientMap[inv.client_id];
    if (!client) { toast.error('Cliente não encontrado'); return; }
    const its = ((itemsData as any) || []).map((d: any) => ({ item_date: d.item_date || today(), service_type: d.service_type, document_number: d.document_number || '', amount: Number(d.amount) }));
    const blob = await generatePDF(inv, its, client);
    window.open(URL.createObjectURL(blob), '_blank');
  };

  const sendWhats = (inv: Invoice) => {
    const client = clientMap[inv.client_id];
    if (!client) return;
    const phone = (client.whatsapp || client.phone || '').replace(/\D/g, '');
    if (!phone) { toast.error('Cliente sem WhatsApp/telefone'); return; }
    const msg = `Olá ${client.name}! 📄\n*Fatura #${inv.invoice_number} — Sucata União*\nValor: ${money(Number(inv.total_amount))}\nVencimento: ${fmtDate(inv.due_date)}\nSegue em anexo o PDF com os detalhes.${inv.pdf_url ? '\n' + inv.pdf_url : ''}\nDúvidas: (31) 99653-5321`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const markPaid = async (inv: Invoice) => {
    const { error } = await supabase.from('invoices' as any).update({ status: 'paga', paid_at: new Date().toISOString() }).eq('id', inv.id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Fatura marcada como paga');
    fetchAll();
  };

  const cancelInvoice = async (inv: Invoice) => {
    if (!confirm('Cancelar esta fatura?')) return;
    const { error } = await supabase.from('invoices' as any).update({ status: 'cancelada' }).eq('id', inv.id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Fatura cancelada'); fetchAll();
  };

  const duplicate = async (inv: Invoice) => {
    const { data: itemsData } = await supabase.from('invoice_items' as any).select('*').eq('invoice_id', inv.id);
    setEditing(null);
    setForm({ client_id: inv.client_id, invoice_date: today(), due_date: addDays(15), invoice_number: '', observations: inv.observations || '' });
    setItems(((itemsData as any) || []).map((d: any) => ({
      item_date: today(), service_type: d.service_type, document_number: d.document_number || '', amount: Number(d.amount),
    })));
    setTab('nova');
    toast.success('Fatura duplicada — edite e salve');
  };

  // ─── Reports ───
  const reportByClient = useMemo(() => {
    const m = new Map<string, number>();
    enrichedInvoices.filter(i => i.status !== 'cancelada').forEach(i => {
      m.set(i.client_id, (m.get(i.client_id) || 0) + Number(i.total_amount));
    });
    return Array.from(m.entries()).map(([cid, total]) => ({ name: clientMap[cid]?.name || '—', total }))
      .sort((a, b) => b.total - a.total);
  }, [enrichedInvoices, clientMap]);

  const exportReportCSV = () => {
    const rows = [['Cliente', 'Total'], ...reportByClient.map(r => [r.name, String(r.total)])];
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `faturamento-clientes-${today()}.csv`; a.click();
  };

  const filteredClientsList = clients.filter(c => {
    const s = clientSearch.toLowerCase();
    return !s || c.name.toLowerCase().includes(s) || c.document_number.includes(clientSearch);
  }).slice(0, 50);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Faturamento de Serviços</h1>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Fatura</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="faturas">Faturas</TabsTrigger>
          <TabsTrigger value="nova">{editing ? `Editar #${editing.invoice_number}` : 'Nova Fatura'}</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
        </TabsList>

        {/* ───────── FATURAS ───────── */}
        <TabsContent value="faturas" className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Total faturado (mês)</p><p className="text-lg font-bold">{money(kpis.totalMes)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Em aberto</p><p className="text-lg font-bold text-info">{money(kpis.abertas)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Vencidas</p><p className="text-lg font-bold text-destructive">{money(kpis.vencidas)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Pagas (mês)</p><p className="text-lg font-bold text-success">{money(kpis.pagasMes)}</p></CardContent></Card>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nº fatura ou cliente..." className="pl-8 h-8 text-xs" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="enviada">Enviada</SelectItem>
                <SelectItem value="paga">Paga</SelectItem>
                <SelectItem value="vencida">Vencida</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2">Nº</th>
                    <th className="text-left p-2">Cliente</th>
                    <th className="text-left p-2">Data</th>
                    <th className="text-left p-2">Vencimento</th>
                    <th className="text-right p-2">Total</th>
                    <th className="text-center p-2">Status</th>
                    <th className="text-center p-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>}
                  {!loading && filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma fatura encontrada</td></tr>}
                  {filtered.map(i => (
                    <tr key={i.id} className="border-t hover:bg-muted/30">
                      <td className="p-2 font-mono">#{i.invoice_number}</td>
                      <td className="p-2">{clientMap[i.client_id]?.name || '—'}</td>
                      <td className="p-2">{fmtDate(i.invoice_date)}</td>
                      <td className="p-2">{fmtDate(i.due_date)}</td>
                      <td className="p-2 text-right font-semibold">{money(Number(i.total_amount))}</td>
                      <td className="p-2 text-center"><Badge variant="outline" className={STATUS_STYLES[i.status] || ''}>{i.status}</Badge></td>
                      <td className="p-2">
                        <div className="flex items-center justify-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Ver PDF" onClick={() => viewPDF(i)}><FileText className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="WhatsApp" onClick={() => sendWhats(i)}><MessageCircle className="h-3.5 w-3.5 text-success" /></Button>
                          {i.status !== 'paga' && i.status !== 'cancelada' && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Marcar paga" onClick={() => markPaid(i)}><Check className="h-3.5 w-3.5 text-success" /></Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Duplicar" onClick={() => duplicate(i)}><Copy className="h-3.5 w-3.5" /></Button>
                          {(i.status === 'rascunho' || i.status === 'enviada') && (
                            <>
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar" onClick={() => loadInvoiceForEdit(i)}><FileText className="h-3.5 w-3.5 text-info" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="Cancelar" onClick={() => cancelInvoice(i)}><X className="h-3.5 w-3.5 text-destructive" /></Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────── NOVA FATURA ───────── */}
        <TabsContent value="nova" className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <Card><CardContent className="p-4 space-y-3">
              <div>
                <Label className="text-xs">Cliente</Label>
                <Input value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Buscar cliente por nome/CNPJ..." className="h-8 text-xs mb-1" />
                <Select value={form.client_id} onValueChange={v => setForm(p => ({ ...p, client_id: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    {filteredClientsList.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name} — {c.document_number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Data da fatura</Label><Input type="date" value={form.invoice_date} onChange={e => setForm(p => ({ ...p, invoice_date: e.target.value }))} className="h-8 text-xs" /></div>
                <div><Label className="text-xs">Vencimento</Label><Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} className="h-8 text-xs" /></div>
              </div>
              <div>
                <Label className="text-xs">Nº da fatura (auto se vazio)</Label>
                <Input value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value.replace(/\D/g, '') }))} className="h-8 text-xs" placeholder="Automático" />
              </div>
            </CardContent></Card>

            <Card><CardContent className="p-4 space-y-2">
              <Label className="text-xs">Observações internas (não aparecem no PDF)</Label>
              <Textarea value={form.observations} onChange={e => setForm(p => ({ ...p, observations: e.target.value }))} className="text-xs min-h-[120px]" />
            </CardContent></Card>
          </div>

          <Card><CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Itens</h3>
              <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Adicionar Item</Button>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left p-1.5 w-32">Data</th>
                  <th className="text-left p-1.5">Serviço</th>
                  <th className="text-left p-1.5 w-40">Nº Documento</th>
                  <th className="text-right p-1.5 w-32">Valor R$</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-1"><Input type="date" value={it.item_date} onChange={e => updateItem(idx, 'item_date', e.target.value)} className="h-7 text-xs" /></td>
                    <td className="p-1">
                      <div className="flex gap-1">
                        <Select value={SERVICE_PRESETS.includes(it.service_type) ? it.service_type : 'Outros'} onValueChange={v => updateItem(idx, 'service_type', v === 'Outros' ? it.service_type : v)}>
                          <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>{SERVICE_PRESETS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input value={it.service_type} onChange={e => updateItem(idx, 'service_type', e.target.value)} className="h-7 text-xs flex-1" placeholder="Descrição do serviço" />
                      </div>
                    </td>
                    <td className="p-1"><Input value={it.document_number} onChange={e => updateItem(idx, 'document_number', e.target.value)} className="h-7 text-xs" placeholder="MTR/NF/Ticket" /></td>
                    <td className="p-1"><Input type="number" step="0.01" value={it.amount} onChange={e => updateItem(idx, 'amount', Number(e.target.value))} className="h-7 text-xs text-right" /></td>
                    <td className="p-1 text-center"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(idx)} disabled={items.length === 1}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold">
                  <td colSpan={3} className="p-2 text-right">TOTAL</td>
                  <td className="p-2 text-right">{money(total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </CardContent></Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetForm}>Limpar</Button>
            <Button variant="outline" onClick={() => saveInvoice(true)}>Salvar como Rascunho</Button>
            <Button onClick={handleGenerateAndSend}><Download className="h-4 w-4 mr-1" /> Gerar PDF e Enviar</Button>
          </div>
        </TabsContent>

        {/* ───────── RELATÓRIOS ───────── */}
        <TabsContent value="relatorios" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={exportReportCSV}><Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV</Button>
          </div>
          <Card><CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-2">Faturamento por Cliente</h3>
            <table className="w-full text-xs">
              <thead className="bg-muted/40"><tr><th className="text-left p-2">Cliente</th><th className="text-right p-2">Total</th></tr></thead>
              <tbody>
                {reportByClient.map(r => (
                  <tr key={r.name} className="border-t"><td className="p-2">{r.name}</td><td className="p-2 text-right font-semibold">{money(r.total)}</td></tr>
                ))}
                {!reportByClient.length && <tr><td colSpan={2} className="p-4 text-center text-muted-foreground">Sem dados</td></tr>}
              </tbody>
            </table>
          </CardContent></Card>

          <Card><CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-2">Inadimplência (vencidas)</h3>
            <table className="w-full text-xs">
              <thead className="bg-muted/40"><tr><th className="text-left p-2">Nº</th><th className="text-left p-2">Cliente</th><th className="text-left p-2">Vencimento</th><th className="text-right p-2">Valor</th><th className="text-center p-2">Dias atraso</th></tr></thead>
              <tbody>
                {enrichedInvoices.filter(i => i.status === 'vencida').map(i => {
                  const days = Math.floor((Date.now() - new Date(i.due_date).getTime()) / 86400000);
                  return (
                    <tr key={i.id} className="border-t">
                      <td className="p-2 font-mono">#{i.invoice_number}</td>
                      <td className="p-2">{clientMap[i.client_id]?.name || '—'}</td>
                      <td className="p-2">{fmtDate(i.due_date)}</td>
                      <td className="p-2 text-right">{money(Number(i.total_amount))}</td>
                      <td className="p-2 text-center text-destructive font-semibold">{days}</td>
                    </tr>
                  );
                })}
                {!enrichedInvoices.some(i => i.status === 'vencida') && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Nenhuma fatura vencida</td></tr>}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
