import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Plus, Search, Scale, Truck, FileText, Eye, Printer,
  CheckCircle2, Clock, Package, X, Weight, Camera, MessageCircle, Wifi,
  PackageOpen, Hourglass,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { RefreshButton } from '@/components/RefreshButton';

// ───────── Types ─────────
interface Client {
  id: string;
  name: string;
  document_number: string;
  vehicle_plate: string | null;
  client_type: string;
  phone?: string | null;
  whatsapp?: string | null;
}

interface Weighing {
  id: string;
  client_id: string;
  ticket_number: number;
  vehicle_plate: string | null;
  material_type: string | null;
  gross_weight: number;
  tare_weight: number;
  net_weight: number | null;
  price_per_kg: number;
  total_value: number | null;
  total_weight: number;
  status: string;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  clients?: { name: string; document_number: string; phone?: string | null; whatsapp?: string | null };
}

interface Fraction {
  id: string;
  weighing_id: string;
  sequence_number: number;
  previous_weight: number;
  current_tare: number;
  net_weight: number;
  material_type: string;
  price_per_kg: number;
  discount_type: string | null;
  discount_value: number;
  final_weight: number;
  subtotal: number;
  photo_url: string | null;
  created_at: string;
}

const MATERIAL_TYPES = [
  { value: 'mista', label: 'Sucata Mista' },
  { value: 'pesada', label: 'Sucata Pesada' },
  { value: 'limaria', label: 'Limaria/Limalha' },
  { value: 'fundido', label: 'Ferro Fundido' },
  { value: 'amortecedor', label: 'Amortecedor' },
  { value: 'aluminio', label: 'Alumínio' },
  { value: 'cobre', label: 'Cobre' },
  { value: 'inox', label: 'Inox' },
  { value: 'latao', label: 'Latão' },
  { value: 'bateria', label: 'Bateria' },
  { value: 'papelao', label: 'Papelão' },
  { value: 'plastico', label: 'Plástico' },
  { value: 'outro', label: 'Outro' },
];

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  em_aberto: { label: 'Em Aberto', variant: 'outline' },
  concluido: { label: 'Concluído', variant: 'default' },
  cancelado: { label: 'Cancelado', variant: 'destructive' },
};

// ───────── Helpers ─────────
const fmtKg = (n: number) => `${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
const fmtBRL = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');
const matLabel = (v: string | null | undefined) =>
  !v ? '—' : MATERIAL_TYPES.find((m) => m.value === v)?.label || v;

function elapsedSince(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rm = min % 60;
  return `${h}h ${rm}min`;
}

export function BalancaFornecedoresTab() {
  const { user } = useAuth();
  const [weighings, setWeighings] = useState<Weighing[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [materialPrices, setMaterialPrices] = useState<Record<string, number>>({});
  const [allFractions, setAllFractions] = useState<Fraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'em_aberto' | 'concluido' | 'cancelado'>('todos');
  const [, forceTick] = useState(0);

  // ── New ticket dialog ──
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [grossInitial, setGrossInitial] = useState('');
  const [ticketNotes, setTicketNotes] = useState('');
  const [savingTicket, setSavingTicket] = useState(false);

  // ── Discharge dialog ──
  const [dischargeFor, setDischargeFor] = useState<Weighing | null>(null);
  const [dischargeFractions, setDischargeFractions] = useState<Fraction[]>([]);
  const [dForm, setDForm] = useState({
    current_tare: '',
    material_type: 'mista',
    price_per_kg: '',
    discount_type: 'percent' as 'percent' | 'kg',
    discount_value: '',
    photo_url: '',
    photo_uploading: false,
  });
  const [savingDischarge, setSavingDischarge] = useState(false);

  // ── View ticket dialog ──
  const [viewTicket, setViewTicket] = useState<Weighing | null>(null);
  const [viewFractions, setViewFractions] = useState<Fraction[]>([]);

  // ───────── Fetch ─────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [wRes, cRes, pRes, fRes] = await Promise.all([
      supabase.from('weighings').select('*, clients(name, document_number, phone, whatsapp)').order('created_at', { ascending: false }).limit(200),
      supabase.from('clients').select('id, name, document_number, vehicle_plate, client_type, phone, whatsapp').eq('status', 'ativo').order('name'),
      supabase.from('material_prices').select('material_type, price_per_kg'),
      supabase.from('weighing_fractions').select('*'),
    ]);
    if (wRes.error) toast.error('Erro ao carregar pesagens');
    setWeighings((wRes.data || []) as Weighing[]);
    setClients((cRes.data || []) as Client[]);
    const map: Record<string, number> = {};
    (pRes.data || []).forEach((r: any) => { map[r.material_type] = Number(r.price_per_kg); });
    setMaterialPrices(map);
    setAllFractions((fRes.data || []) as Fraction[]);
    setLoading(false);
  }, []);

  const { refresh, isRefreshing, lastRefreshAt } = useAutoRefresh(fetchAll);

  // Re-render every 30s so "tempo decorrido" cards update
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // ───────── Derived ─────────
  const fractionsByWeighing = useMemo(() => {
    const m: Record<string, Fraction[]> = {};
    allFractions.forEach((f) => {
      (m[f.weighing_id] ||= []).push(f);
    });
    Object.values(m).forEach((arr) => arr.sort((a, b) => a.sequence_number - b.sequence_number));
    return m;
  }, [allFractions]);

  const openTickets = useMemo(
    () => weighings.filter((w) => w.status === 'em_aberto').sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)),
    [weighings],
  );

  const filtered = useMemo(() => {
    return weighings.filter((w) => {
      if (statusFilter !== 'todos' && w.status !== statusFilter) return false;
      const term = searchTerm.toLowerCase().trim();
      if (!term) return true;
      return (
        w.ticket_number.toString().includes(term) ||
        (w.vehicle_plate || '').toLowerCase().includes(term) ||
        (w.clients?.name || '').toLowerCase().includes(term) ||
        (w.clients?.document_number || '').includes(term)
      );
    });
  }, [weighings, searchTerm, statusFilter]);

  // ── Stats ──
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDone = weighings.filter((w) => w.created_at.slice(0, 10) === todayStr && w.status === 'concluido');
  const totalWeightToday = todayDone.reduce((s, w) => s + Number(w.total_weight || 0), 0);
  const totalValueToday = todayDone.reduce((s, w) => s + Number(w.total_value || 0), 0);

  const filteredClients = clients.filter((c) => {
    const t = clientSearch.toLowerCase();
    if (!t) return true;
    return (
      c.name.toLowerCase().includes(t) ||
      c.document_number.includes(t) ||
      (c.vehicle_plate || '').toLowerCase().includes(t)
    );
  });

  // ───────── Photo upload ─────────
  const uploadPhoto = async (file: File): Promise<string | null> => {
    setDForm((p) => ({ ...p, photo_uploading: true }));
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `discharges/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('weighing-photos').upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('weighing-photos').getPublicUrl(path);
      setDForm((p) => ({ ...p, photo_url: data.publicUrl, photo_uploading: false }));
      toast.success('Foto enviada');
      return data.publicUrl;
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar foto');
      setDForm((p) => ({ ...p, photo_uploading: false }));
      return null;
    }
  };

  // ───────── Open Ticket ─────────
  const resetNewTicket = () => {
    setShowNewTicket(false);
    setSelectedClientId('');
    setClientSearch('');
    setVehiclePlate('');
    setGrossInitial('');
    setTicketNotes('');
  };

  const handleOpenTicket = async () => {
    if (!selectedClientId) { toast.error('Selecione um cliente'); return; }
    const gross = parseFloat(grossInitial);
    if (!gross || gross <= 0) { toast.error('Informe o peso bruto inicial'); return; }

    setSavingTicket(true);
    try {
      const { data, error } = await supabase
        .from('weighings')
        .insert({
          client_id: selectedClientId,
          vehicle_plate: vehiclePlate || null,
          material_type: null,
          gross_weight: gross,
          tare_weight: 0,
          total_weight: 0,
          price_per_kg: 0,
          status: 'em_aberto',
          notes: ticketNotes || null,
          created_by: user?.id || null,
        })
        .select('ticket_number')
        .single();
      if (error) throw error;
      toast.success(`Ticket #${data.ticket_number} aberto. Aguardando descarga.`);
      resetNewTicket();
      refresh();
    } catch (err: any) {
      toast.error('Erro ao abrir ticket: ' + (err?.message || ''));
    } finally {
      setSavingTicket(false);
    }
  };

  // ───────── Discharge ─────────
  const openDischarge = (w: Weighing) => {
    setDischargeFor(w);
    setDischargeFractions(fractionsByWeighing[w.id] || []);
    setDForm({
      current_tare: '',
      material_type: 'mista',
      price_per_kg: materialPrices['mista'] != null ? String(materialPrices['mista']) : '',
      discount_type: 'percent',
      discount_value: '',
      photo_url: '',
      photo_uploading: false,
    });
  };

  const closeDischarge = () => {
    setDischargeFor(null);
    setDischargeFractions([]);
  };

  const previousWeight = useMemo(() => {
    if (!dischargeFor) return 0;
    if (dischargeFractions.length === 0) return Number(dischargeFor.gross_weight) || 0;
    return Number(dischargeFractions[dischargeFractions.length - 1].current_tare) || 0;
  }, [dischargeFor, dischargeFractions]);

  const dCalc = useMemo(() => {
    const tare = parseFloat(dForm.current_tare) || 0;
    const net = Math.max(0, previousWeight - tare);
    const dv = parseFloat(dForm.discount_value) || 0;
    let final = net;
    if (dForm.discount_type === 'percent') final = Math.max(0, net * (1 - Math.min(100, Math.max(0, dv)) / 100));
    else final = Math.max(0, net - dv);
    const price = parseFloat(dForm.price_per_kg) || 0;
    return { tare, net, final, subtotal: final * price, price };
  }, [dForm, previousWeight]);

  const handleMaterialChange = (v: string) => {
    const preset = materialPrices[v];
    setDForm((p) => ({ ...p, material_type: v, price_per_kg: preset != null ? String(preset) : p.price_per_kg }));
  };

  const insertDischarge = async (): Promise<Fraction | null> => {
    if (!dischargeFor || !user) return null;
    const tare = parseFloat(dForm.current_tare);
    if (Number.isNaN(tare) || tare < 0) { toast.error('Informe a tara (peso atual na balança)'); return null; }
    if (tare > previousWeight) { toast.error('Tara não pode ser maior que o peso anterior'); return null; }
    if (!dForm.material_type) { toast.error('Selecione o tipo de material'); return null; }
    if (!(parseFloat(dForm.price_per_kg) > 0)) { toast.error('Informe o preço por kg'); return null; }

    const seq = dischargeFractions.length + 1;
    const payload = {
      weighing_id: dischargeFor.id,
      sequence_number: seq,
      previous_weight: previousWeight,
      current_tare: tare,
      material_type: dForm.material_type,
      price_per_kg: dCalc.price,
      discount_type: dForm.discount_value ? dForm.discount_type : null,
      discount_value: parseFloat(dForm.discount_value) || 0,
      final_weight: dCalc.final,
      subtotal: dCalc.subtotal,
      photo_url: dForm.photo_url || null,
      created_by: user.id,
    };
    const { data, error } = await supabase.from('weighing_fractions').insert(payload).select().single();
    if (error) { toast.error('Erro ao salvar descarga: ' + error.message); return null; }
    return data as Fraction;
  };

  const handleConfirmAndWait = async () => {
    setSavingDischarge(true);
    const created = await insertDischarge();
    setSavingDischarge(false);
    if (!created || !dischargeFor) return;
    toast.success('Descarga registrada. Ticket aguardando próxima.');
    // Refresh local fractions for the modal so the next previous_weight is correct
    const newFracs = [...dischargeFractions, created];
    setDischargeFractions(newFracs);
    setAllFractions((p) => [...p, created]);
    // Reset form for next discharge
    setDForm({
      current_tare: '',
      material_type: 'mista',
      price_per_kg: materialPrices['mista'] != null ? String(materialPrices['mista']) : '',
      discount_type: 'percent',
      discount_value: '',
      photo_url: '',
      photo_uploading: false,
    });
  };

  const finalizeTicket = async (w: Weighing, fractions: Fraction[]) => {
    const totalWeight = fractions.reduce((s, f) => s + Number(f.final_weight || 0), 0);
    const totalValue = fractions.reduce((s, f) => s + Number(f.subtotal || 0), 0);
    const avgPrice = totalWeight > 0 ? totalValue / totalWeight : 0;
    const lastTare = fractions.length > 0 ? Number(fractions[fractions.length - 1].current_tare) : 0;

    const { error: upErr } = await supabase
      .from('weighings')
      .update({
        status: 'concluido',
        total_weight: totalWeight,
        final_net_weight: totalWeight,
        tare_weight: lastTare,
        material_type: 'multiplo',
        price_per_kg: avgPrice,
      } as any)
      .eq('id', w.id);
    if (upErr) { toast.error('Erro ao finalizar ticket'); return false; }

    // client_transactions entry
    const sumByMat = (mat: string) =>
      fractions.filter((f) => f.material_type === mat).reduce((s, f) => s + Number(f.final_weight || 0), 0);

    const { error: txErr } = await supabase.from('client_transactions').insert({
      client_id: w.client_id,
      type: 'pesagem',
      description: `Ticket #${w.ticket_number}`,
      amount: totalValue,
      status: 'aberto',
      transaction_date: w.created_at,
      mista_kg: sumByMat('mista'),
      pesada_kg: sumByMat('pesada'),
      limaria_kg: sumByMat('limaria'),
      fundido_kg: sumByMat('fundido'),
      amortecedor_kg: sumByMat('amortecedor'),
      total_kg: totalWeight,
      price_used: avgPrice,
      value: totalValue,
      ticket_number: w.ticket_number,
      created_by: user?.id || null,
    });
    if (txErr) console.warn('client_transactions insert failed', txErr);
    return true;
  };

  const handleConfirmAndFinalize = async () => {
    if (!dischargeFor) return;
    setSavingDischarge(true);
    let fractions = dischargeFractions;
    const tare = parseFloat(dForm.current_tare);
    if (!Number.isNaN(tare) && tare >= 0 && dForm.material_type && parseFloat(dForm.price_per_kg) > 0) {
      const created = await insertDischarge();
      if (!created) { setSavingDischarge(false); return; }
      fractions = [...fractions, created];
      setAllFractions((p) => [...p, created]);
    }
    if (fractions.length === 0) {
      toast.error('Registre ao menos uma descarga antes de finalizar');
      setSavingDischarge(false);
      return;
    }
    const ok = await finalizeTicket(dischargeFor, fractions);
    setSavingDischarge(false);
    if (!ok) return;
    toast.success(`Ticket #${dischargeFor.ticket_number} finalizado e lançado na conta corrente`);
    closeDischarge();
    refresh();
  };

  const handleCancelTicketFromOpen = async (w: Weighing) => {
    if (!confirm(`Cancelar Ticket #${w.ticket_number}?`)) return;
    const { error } = await supabase.from('weighings').update({ status: 'cancelado' }).eq('id', w.id);
    if (error) toast.error('Erro ao cancelar');
    else { toast.success('Ticket cancelado'); refresh(); }
  };

  // ── View ticket ──
  const handleViewTicket = (w: Weighing) => {
    setViewTicket(w);
    setViewFractions(fractionsByWeighing[w.id] || []);
  };

  // ───────── Print / WhatsApp ─────────
  const handlePrint = () => window.print();

  const buildWhatsappUrl = (t: Weighing, fracs: Fraction[]) => {
    const phone = (t.clients?.whatsapp || t.clients?.phone || '').replace(/\D/g, '');
    if (!phone) return null;
    const totalKg = fracs.reduce((s, f) => s + Number(f.final_weight || 0), 0);
    const totalValue = fracs.reduce((s, f) => s + Number(f.subtotal || 0), 0);
    const lines = fracs.map(
      (f) => `${matLabel(f.material_type)}: ${Number(f.final_weight).toFixed(2)} kg × R$ ${Number(f.price_per_kg).toFixed(2)}/kg = R$ ${Number(f.subtotal).toFixed(2)}`,
    );
    const msg = `Olá ${t.clients?.name || ''}! 🏭
*Ticket #${t.ticket_number} - Sucata União*
Data: ${fmtDate(t.created_at)}
─────────────────
${lines.join('\n')}
─────────────────
*Total: ${totalKg.toFixed(2)} kg*
*Valor: R$ ${totalValue.toFixed(2)}*

Obrigado pela parceria! ✅`;
    return `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`;
  };

  const handleSendWhatsapp = () => {
    if (!viewTicket) return;
    const url = buildWhatsappUrl(viewTicket, viewFractions);
    if (!url) { toast.error('Cliente sem telefone/WhatsApp cadastrado'); return; }
    window.open(url, '_blank');
  };

  // ───────── Render ─────────
  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          @page { margin: 0; size: 80mm auto; }
          body * { visibility: hidden; }
          #print-ticket, #print-ticket * { visibility: visible; }
          #print-ticket { position: absolute; left: 0; top: 0; width: 80mm; font-family: 'Courier New', monospace; font-size: 11px; color: #000; background: #fff; padding: 4mm; }
          .no-print { display: none !important; }
        }
        #print-ticket { display: none; }
        @media print { #print-ticket { display: block; } }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="h-7 w-7 text-primary" /> Balança / Pesagem
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Tickets em aberto e pesagens fracionadas</p>
        </div>
        <div className="flex items-center gap-3">
          <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} lastRefreshAt={lastRefreshAt} />
          <Badge className="bg-yellow-400 text-yellow-950 hover:bg-yellow-400 gap-1">
            <Wifi className="h-3 w-3" /> Balança: Manual
          </Badge>
          <Button onClick={() => setShowNewTicket(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Abrir Ticket
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
        <Card><CardContent className="pt-4 pb-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><FileText className="h-5 w-5 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">Concluídos Hoje</p><p className="text-xl font-bold">{todayDone.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/10"><Weight className="h-5 w-5 text-accent" /></div>
          <div><p className="text-xs text-muted-foreground">Peso Hoje</p><p className="text-xl font-bold">{fmtKg(totalWeightToday)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10"><Package className="h-5 w-5 text-success" /></div>
          <div><p className="text-xs text-muted-foreground">Valor Hoje</p><p className="text-xl font-bold">{fmtBRL(totalValueToday)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/10"><Hourglass className="h-5 w-5 text-orange-500" /></div>
          <div><p className="text-xs text-muted-foreground">Em Aberto</p><p className="text-xl font-bold">{openTickets.length}</p></div>
        </CardContent></Card>
      </div>

      {/* Open tickets section */}
      {openTickets.length > 0 && (
        <div className="no-print">
          <div className="flex items-center gap-2 mb-2">
            <Hourglass className="h-4 w-4 text-orange-500" />
            <h2 className="text-base font-bold">Tickets em Aberto ({openTickets.length})</h2>
            <span className="text-xs text-muted-foreground">aguardando descarga</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {openTickets.map((w) => {
              const frs = fractionsByWeighing[w.id] || [];
              const partial = frs.reduce((s, f) => s + Number(f.final_weight || 0), 0);
              return (
                <Card key={w.id} className="border-orange-300 bg-orange-50 dark:bg-orange-950/20">
                  <CardContent className="pt-3 pb-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="font-mono font-bold text-orange-700 border-orange-300">#{w.ticket_number}</Badge>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {elapsedSince(w.created_at)}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm truncate">{w.clients?.name || '—'}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Truck className="h-3 w-3" /> {w.vehicle_plate || '—'} · Bruto: {fmtKg(w.gross_weight)}
                      </p>
                      {frs.length > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {frs.length} descarga{frs.length > 1 ? 's' : ''} · {fmtKg(partial)} parcial
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 gap-1 bg-orange-600 hover:bg-orange-700" onClick={() => openDischarge(w)}>
                        <PackageOpen className="h-3 w-3" /> Registrar Descarga
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleCancelTicketFromOpen(w)}>
                        <X className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 no-print">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por ticket, placa, cliente ou CPF/CNPJ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="em_aberto">Em Aberto</SelectItem>
            <SelectItem value="concluido">Concluídos</SelectItem>
            <SelectItem value="cancelado">Cancelados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="no-print">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Scale className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma pesagem encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">Ticket</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead className="text-right">Bruto Inicial</TableHead>
                  <TableHead className="text-right">Total Líquido</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((w) => {
                  const st = STATUS_MAP[w.status] || { label: w.status, variant: 'secondary' as const };
                  return (
                    <TableRow key={w.id}>
                      <TableCell className="font-mono font-bold text-primary">#{w.ticket_number}</TableCell>
                      <TableCell className="font-medium">{w.clients?.name || '—'}</TableCell>
                      <TableCell>
                        {w.vehicle_plate ? (
                          <Badge variant="outline" className="font-mono"><Truck className="h-3 w-3 mr-1" />{w.vehicle_plate}</Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono">{fmtKg(w.gross_weight)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{fmtKg(w.total_weight || 0)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{fmtBRL(w.total_value || 0)}</TableCell>
                      <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDateTime(w.created_at)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleViewTicket(w)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ═══════ NEW TICKET DIALOG (Etapa 1) ═══════ */}
      <Dialog open={showNewTicket} onOpenChange={(o) => { if (!o) resetNewTicket(); else setShowNewTicket(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" /> Novo Ticket de Pesagem
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Input
                placeholder="Buscar por nome, CPF/CNPJ ou placa..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
              {clientSearch && !selectedClientId && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {filteredClients.slice(0, 10).map((c) => (
                    <button key={c.id}
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex justify-between"
                      onClick={() => {
                        setSelectedClientId(c.id);
                        setClientSearch(c.name);
                        if (c.vehicle_plate) setVehiclePlate(c.vehicle_plate);
                      }}
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground">{c.document_number}</span>
                    </button>
                  ))}
                  {filteredClients.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum cliente encontrado</p>
                  )}
                </div>
              )}
              {selectedClientId && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3" />{clientSearch}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedClientId(''); setClientSearch(''); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Placa do Veículo</Label>
              <Input placeholder="ABC-1D23" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())} maxLength={8} />
            </div>

            <div className="space-y-2">
              <Label>Peso Bruto Inicial (kg) *</Label>
              <Input type="number" step="0.01" placeholder="0,00" value={grossInitial} onChange={(e) => setGrossInitial(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">Peso do caminhão cheio na chegada.</p>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea rows={2} value={ticketNotes} onChange={(e) => setTicketNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetNewTicket}>Cancelar</Button>
            <Button onClick={handleOpenTicket} disabled={savingTicket} className="gap-2">
              {savingTicket ? 'Abrindo...' : (<><Hourglass className="h-4 w-4" />Abrir Ticket</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════ DISCHARGE DIALOG (Etapas 3, 4, 5) ═══════ */}
      <Dialog open={!!dischargeFor} onOpenChange={(o) => { if (!o) closeDischarge(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageOpen className="h-5 w-5 text-orange-600" />
              Registrar Descarga — Ticket #{dischargeFor?.ticket_number}
            </DialogTitle>
          </DialogHeader>

          {dischargeFor && (
            <div className="space-y-4">
              {/* Header info */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-muted/40 rounded p-2">
                <div><span className="text-muted-foreground">Cliente:</span> <strong>{dischargeFor.clients?.name}</strong></div>
                <div><span className="text-muted-foreground">Placa:</span> <strong className="font-mono">{dischargeFor.vehicle_plate || '—'}</strong></div>
                <div><span className="text-muted-foreground">Bruto inicial:</span> <strong>{fmtKg(dischargeFor.gross_weight)}</strong></div>
                <div><span className="text-muted-foreground">Descargas até agora:</span> <strong>{dischargeFractions.length}</strong></div>
              </div>

              {/* Previous discharges list */}
              {dischargeFractions.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Descargas anteriores</Label>
                  <div className="border rounded text-xs">
                    {dischargeFractions.map((f) => (
                      <div key={f.id} className="flex justify-between px-2 py-1 border-b last:border-0">
                        <span>#{f.sequence_number} — {matLabel(f.material_type)}</span>
                        <span className="font-mono">{fmtKg(f.final_weight)} · {fmtBRL(f.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* New discharge form */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo de Material *</Label>
                    <Select value={dForm.material_type} onValueChange={handleMaterialChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MATERIAL_TYPES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Preço/kg (R$) *</Label>
                    <Input type="number" step="0.01" value={dForm.price_per_kg}
                      onChange={(e) => setDForm((p) => ({ ...p, price_per_kg: e.target.value }))} />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Peso atual na balança / Tara (kg) *</Label>
                    <Input type="number" step="0.01" placeholder="Peso após descarregar este material"
                      value={dForm.current_tare}
                      onChange={(e) => setDForm((p) => ({ ...p, current_tare: e.target.value }))} />
                  </div>
                </div>

                {/* Discount */}
                <div className="rounded-md border p-3 space-y-2">
                  <Label className="text-xs font-semibold">Desconto de Impureza</Label>
                  <RadioGroup
                    value={dForm.discount_type}
                    onValueChange={(v) => setDForm((p) => ({ ...p, discount_type: v as 'percent' | 'kg', discount_value: '' }))}
                    className="flex gap-4"
                  >
                    <div className="flex items-center gap-2"><RadioGroupItem value="percent" id="d-pct" /><Label htmlFor="d-pct" className="text-xs cursor-pointer">Percentual (%)</Label></div>
                    <div className="flex items-center gap-2"><RadioGroupItem value="kg" id="d-kg" /><Label htmlFor="d-kg" className="text-xs cursor-pointer">Em kg</Label></div>
                  </RadioGroup>
                  <Input type="number" step="0.01"
                    placeholder={dForm.discount_type === 'percent' ? '0-100' : '0,00 kg'}
                    value={dForm.discount_value}
                    onChange={(e) => setDForm((p) => ({ ...p, discount_value: e.target.value }))} />
                </div>

                {/* Photo */}
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ''; }} />
                    <Button variant="outline" size="sm" asChild>
                      <span className="gap-1 inline-flex items-center">
                        <Camera className="h-3 w-3" />
                        {dForm.photo_uploading ? 'Enviando...' : 'Foto da carga'}
                      </span>
                    </Button>
                  </label>
                  {dForm.photo_url && (
                    <a href={dForm.photo_url} target="_blank" rel="noreferrer">
                      <img src={dForm.photo_url} alt="" className="h-12 w-12 object-cover rounded border" />
                    </a>
                  )}
                </div>

                {/* Live calculations */}
                <div className="bg-primary/5 border border-primary/20 rounded p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Peso anterior:</span><span className="font-mono">{fmtKg(previousWeight)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tara atual:</span><span className="font-mono">{fmtKg(dCalc.tare)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Peso líquido:</span><span className="font-mono">{fmtKg(dCalc.net)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Desconto aplicado:</span><span className="font-mono">{fmtKg(dCalc.net - dCalc.final)}</span></div>
                  <Separator className="my-1" />
                  <div className="flex justify-between font-semibold"><span>Peso Final desta descarga:</span><span className="font-mono">{fmtKg(dCalc.final)}</span></div>
                  <div className="flex justify-between font-bold text-primary"><span>Subtotal:</span><span className="font-mono">{fmtBRL(dCalc.subtotal)}</span></div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={closeDischarge}>Fechar</Button>
            <Button variant="secondary" onClick={handleConfirmAndWait} disabled={savingDischarge} className="gap-1">
              <Hourglass className="h-4 w-4" /> Confirmar e Aguardar Próximo
            </Button>
            <Button onClick={handleConfirmAndFinalize} disabled={savingDischarge} className="gap-1">
              <CheckCircle2 className="h-4 w-4" /> Confirmar e Finalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════ VIEW TICKET DIALOG ═══════ */}
      <Dialog open={!!viewTicket} onOpenChange={(o) => { if (!o) { setViewTicket(null); setViewFractions([]); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Ticket #{viewTicket?.ticket_number}
            </DialogTitle>
          </DialogHeader>

          {viewTicket && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground">Cliente</p><p className="font-medium">{viewTicket.clients?.name}</p></div>
                <div><p className="text-muted-foreground">CPF/CNPJ</p><p className="font-mono">{viewTicket.clients?.document_number}</p></div>
                <div><p className="text-muted-foreground">Placa</p><p className="font-mono">{viewTicket.vehicle_plate || '—'}</p></div>
                <div><p className="text-muted-foreground">Data</p><p>{fmtDateTime(viewTicket.created_at)}</p></div>
                <div><p className="text-muted-foreground">Bruto Inicial</p><p className="font-mono">{fmtKg(viewTicket.gross_weight)}</p></div>
                <div><p className="text-muted-foreground">Status</p><Badge variant={(STATUS_MAP[viewTicket.status]?.variant) || 'secondary'}>{STATUS_MAP[viewTicket.status]?.label || viewTicket.status}</Badge></div>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="font-semibold text-sm">Descargas</p>
                {viewFractions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma descarga registrada.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-right">Anterior</TableHead>
                        <TableHead className="text-right">Tara</TableHead>
                        <TableHead className="text-right">Final</TableHead>
                        <TableHead className="text-right">R$/kg</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead>Foto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewFractions.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="font-mono">#{f.sequence_number}</TableCell>
                          <TableCell>{matLabel(f.material_type)}</TableCell>
                          <TableCell className="text-right font-mono">{fmtKg(f.previous_weight)}</TableCell>
                          <TableCell className="text-right font-mono">{fmtKg(f.current_tare)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{fmtKg(f.final_weight)}</TableCell>
                          <TableCell className="text-right font-mono">{fmtBRL(f.price_per_kg)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{fmtBRL(f.subtotal)}</TableCell>
                          <TableCell>
                            {f.photo_url ? (
                              <a href={f.photo_url} target="_blank" rel="noreferrer">
                                <img src={f.photo_url} alt="" className="h-8 w-8 object-cover rounded" />
                              </a>
                            ) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {viewFractions.length > 0 && (
                  <div className="flex justify-between items-center bg-primary/5 rounded-lg p-3">
                    <span className="font-medium">Total</span>
                    <div className="text-right">
                      <p className="text-sm">{fmtKg(viewFractions.reduce((s, f) => s + Number(f.final_weight || 0), 0))}</p>
                      <p className="font-bold text-primary">{fmtBRL(viewFractions.reduce((s, f) => s + Number(f.subtotal || 0), 0))}</p>
                    </div>
                  </div>
                )}
              </div>

              {viewTicket.notes && (
                <>
                  <Separator />
                  <div><p className="text-sm text-muted-foreground">Observações</p><p className="text-sm">{viewTicket.notes}</p></div>
                </>
              )}

              <Separator />

              <div className="flex flex-wrap gap-2 justify-end">
                {viewTicket.status === 'em_aberto' && (
                  <Button onClick={() => { openDischarge(viewTicket); setViewTicket(null); }} className="gap-1 bg-orange-600 hover:bg-orange-700">
                    <PackageOpen className="h-4 w-4" /> Registrar Descarga
                  </Button>
                )}
                {viewTicket.status === 'concluido' && (
                  <>
                    <Button variant="outline" onClick={handlePrint} className="gap-1"><Printer className="h-4 w-4" />Imprimir Ticket</Button>
                    <Button variant="outline" onClick={handleSendWhatsapp} className="gap-1 text-green-700 border-green-200">
                      <MessageCircle className="h-4 w-4" /> Enviar WhatsApp
                    </Button>
                  </>
                )}
                {viewTicket.status === 'em_aberto' && (
                  <Button variant="outline" onClick={() => { handleCancelTicketFromOpen(viewTicket); setViewTicket(null); }} className="gap-1 text-destructive">
                    <X className="h-4 w-4" /> Cancelar Ticket
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Print layout */}
          {viewTicket && (
            <div id="print-ticket">
              <div style={{ textAlign: 'center', fontWeight: 'bold' }}>
                ================================<br />
                SUCATA UNIÃO LTDA<br />
                WhatsApp: (31) 99653-5321<br />
                Santa Luzia - MG<br />
                Ticket #{viewTicket.ticket_number} - {fmtDate(viewTicket.created_at)}<br />
                ================================
              </div>
              <div style={{ marginTop: 6 }}>
                Cliente: {viewTicket.clients?.name}<br />
                Placa: {viewTicket.vehicle_plate || '-'}<br />
                Bruto Inicial: {Number(viewTicket.gross_weight).toFixed(2)} kg<br />
                --------------------------------
              </div>
              {viewFractions.map((f) => (
                <div key={f.id} style={{ marginTop: 4 }}>
                  <strong>#{f.sequence_number} {matLabel(f.material_type).toUpperCase()}</strong><br />
                  Anterior:      {Number(f.previous_weight).toFixed(2)} kg<br />
                  Tara:          {Number(f.current_tare).toFixed(2)} kg<br />
                  Líquido:       {Number(f.net_weight).toFixed(2)} kg<br />
                  Peso Final:    {Number(f.final_weight).toFixed(2)} kg<br />
                  Preço:         R$ {Number(f.price_per_kg).toFixed(2)}/kg<br />
                  Subtotal:      R$ {Number(f.subtotal).toFixed(2)}<br />
                  --------------------------------
                </div>
              ))}
              <div style={{ marginTop: 4, fontWeight: 'bold' }}>
                TOTAL:         {viewFractions.reduce((s, f) => s + Number(f.final_weight || 0), 0).toFixed(2)} kg<br />
                VALOR TOTAL:   R$ {viewFractions.reduce((s, f) => s + Number(f.subtotal || 0), 0).toFixed(2)}<br />
                ================================<br />
                Pesador: {user?.full_name || '-'}<br />
                {new Date().toLocaleString('pt-BR')}<br />
                ================================
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}