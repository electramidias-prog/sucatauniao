import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import {
  Plus, Search, Scale, Truck, FileText, Eye, Printer,
  CheckCircle2, Clock, Package, X, Trash2, Weight, Camera, MessageCircle, Wifi,
} from 'lucide-react';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { RefreshButton } from '@/components/RefreshButton';

// ─── Types ───
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
  material_type: string;
  gross_weight: number;
  tare_weight: number;
  net_weight: number | null;
  price_per_kg: number;
  total_value: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  discount_type?: string | null;
  discount_value?: number | null;
  final_net_weight?: number | null;
  photo_url?: string | null;
  clients?: { name: string; document_number: string; phone?: string | null; whatsapp?: string | null };
}

interface FractionItem {
  material_type: string;
  gross_weight: string;
  tare_weight: string;
  price_per_kg: string;
  discount_type: 'percent' | 'kg';
  discount_value: string;
  photo_url: string;
  photo_uploading: boolean;
  price_overridden: boolean;
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
  pendente: { label: 'Pendente', variant: 'secondary' },
  aberto: { label: 'Ticket Aberto', variant: 'outline' },
  pesado: { label: 'Pesado', variant: 'default' },
  concluido: { label: 'Concluído', variant: 'default' },
  pago: { label: 'Pago', variant: 'default' },
  cancelado: { label: 'Cancelado', variant: 'destructive' },
};

const emptyFraction = (): FractionItem => ({
  material_type: 'mista',
  gross_weight: '',
  tare_weight: '',
  price_per_kg: '',
  discount_type: 'percent',
  discount_value: '',
  photo_url: '',
  photo_uploading: false,
  price_overridden: false,
});

export function BalancaPage() {
  const { user } = useAuth();
  const [weighings, setWeighings] = useState<Weighing[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [materialPrices, setMaterialPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  // New ticket dialog
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [ticketNotes, setTicketNotes] = useState('');
  const [fractions, setFractions] = useState<FractionItem[]>([emptyFraction()]);

  // View ticket dialog
  const [viewTicket, setViewTicket] = useState<Weighing | null>(null);
  const [ticketFractions, setTicketFractions] = useState<Weighing[]>([]);

  const [saving, setSaving] = useState(false);

  // ─── Fetch data ───
  const fetchWeighings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('weighings')
      .select('*, clients(name, document_number, phone, whatsapp)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      toast.error('Erro ao carregar pesagens');
      console.error(error);
    } else {
      setWeighings((data as Weighing[]) || []);
    }
    setLoading(false);
  }, []);

  const fetchClients = useCallback(async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, name, document_number, vehicle_plate, client_type, phone, whatsapp')
      .eq('status', 'ativo')
      .order('name');
    setClients(data || []);
  }, []);

  const fetchMaterialPrices = useCallback(async () => {
    const { data } = await supabase.from('material_prices').select('material_type, price_per_kg');
    if (data) {
      const map: Record<string, number> = {};
      data.forEach((row: { material_type: string; price_per_kg: number }) => {
        map[row.material_type] = Number(row.price_per_kg);
      });
      setMaterialPrices(map);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchWeighings(), fetchClients(), fetchMaterialPrices()]);
  }, [fetchWeighings, fetchClients, fetchMaterialPrices]);
  const { refresh, isRefreshing, lastRefreshAt } = useAutoRefresh(refreshAll);

  // ─── Helpers ───
  const formatWeight = (kg: number) => `${kg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg`;
  const formatCurrency = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (d: string) =>
    new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const formatDateOnly = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR');
  const getMaterialLabel = (val: string) =>
    MATERIAL_TYPES.find((m) => m.value === val)?.label || val;

  // ─── Calculations ───
  const calcNet = (gross: string, tare: string) => {
    const g = parseFloat(gross) || 0;
    const t = parseFloat(tare) || 0;
    return Math.max(0, g - t);
  };

  const calcFinalNet = (f: FractionItem) => {
    const net = calcNet(f.gross_weight, f.tare_weight);
    const dv = parseFloat(f.discount_value) || 0;
    if (f.discount_type === 'percent') {
      const pct = Math.min(100, Math.max(0, dv));
      return Math.max(0, net * (1 - pct / 100));
    }
    return Math.max(0, net - dv);
  };

  const calcSubtotal = (f: FractionItem) => calcFinalNet(f) * (parseFloat(f.price_per_kg) || 0);

  // ─── Filter ───
  const filtered = weighings.filter((w) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      w.ticket_number.toString().includes(term) ||
      (w.vehicle_plate || '').toLowerCase().includes(term) ||
      (w.clients?.name || '').toLowerCase().includes(term) ||
      (w.clients?.document_number || '').includes(term);
    const matchesStatus = statusFilter === 'todos' || w.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // ─── Fraction management ───
  const addFraction = () => setFractions((p) => [...p, emptyFraction()]);

  const removeFraction = (idx: number) => {
    if (fractions.length <= 1) return;
    setFractions((p) => p.filter((_, i) => i !== idx));
  };

  const updateFraction = (idx: number, patch: Partial<FractionItem>) => {
    setFractions((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const handleMaterialChange = (idx: number, value: string) => {
    const presetPrice = materialPrices[value];
    setFractions((prev) =>
      prev.map((f, i) => {
        if (i !== idx) return f;
        const shouldPrefill = !f.price_overridden || !f.price_per_kg;
        return {
          ...f,
          material_type: value,
          price_per_kg: shouldPrefill && presetPrice != null ? String(presetPrice) : f.price_per_kg,
          price_overridden: shouldPrefill ? false : f.price_overridden,
        };
      }),
    );
  };

  const handlePriceChange = async (idx: number, value: string) => {
    const f = fractions[idx];
    const preset = materialPrices[f.material_type];
    const numeric = parseFloat(value);
    const overrode = preset != null && !Number.isNaN(numeric) && numeric !== preset;
    updateFraction(idx, { price_per_kg: value, price_overridden: overrode });
    if (overrode && user?.id) {
      // Audit log async, do not block UI
      supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'price_override',
        table_name: 'weighings',
        new_value: { material_type: f.material_type, default_price: preset, used_price: numeric },
      }).then(({ error }) => { if (error) console.warn('audit log failed', error); });
    }
  };

  // ─── Photo upload ───
  const handlePhotoUpload = async (idx: number, file: File) => {
    if (!file) return;
    updateFraction(idx, { photo_uploading: true });
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `temp/${Date.now()}_${idx}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('weighing-photos')
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('weighing-photos').getPublicUrl(path);
      updateFraction(idx, { photo_url: pub.publicUrl, photo_uploading: false });
      toast.success('Foto enviada');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar foto');
      updateFraction(idx, { photo_uploading: false });
    }
  };

  // ─── Save ticket ───
  const handleSaveTicket = async () => {
    if (!selectedClientId) {
      toast.error('Selecione um cliente');
      return;
    }
    const valid = fractions.filter((f) => parseFloat(f.gross_weight) > 0);
    if (valid.length === 0) {
      toast.error('Informe pelo menos um material com peso bruto');
      return;
    }

    setSaving(true);
    try {
      const buildRow = (f: FractionItem, ticketNumber?: number) => {
        const net = calcNet(f.gross_weight, f.tare_weight);
        const finalNet = calcFinalNet(f);
        const price = parseFloat(f.price_per_kg) || 0;
        return {
          client_id: selectedClientId,
          vehicle_plate: vehiclePlate || null,
          material_type: f.material_type,
          gross_weight: parseFloat(f.gross_weight) || 0,
          tare_weight: parseFloat(f.tare_weight) || 0,
          net_weight: net,
          final_net_weight: finalNet,
          discount_type: f.discount_value ? f.discount_type : null,
          discount_value: parseFloat(f.discount_value) || 0,
          price_per_kg: price,
          total_value: finalNet * price,
          status: valid.length > 1 ? 'aberto' : 'pesado',
          notes: ticketNotes || null,
          created_by: user?.id || null,
          photo_url: f.photo_url || null,
          ...(ticketNumber ? { ticket_number: ticketNumber } : {}),
        };
      };

      const { data: firstRow, error: firstErr } = await supabase
        .from('weighings')
        .insert(buildRow(valid[0]))
        .select('ticket_number')
        .single();
      if (firstErr) throw firstErr;

      const ticketNumber = firstRow.ticket_number;

      if (valid.length > 1) {
        const remaining = valid.slice(1).map((f) => buildRow(f, ticketNumber));
        const { error: remErr } = await supabase.from('weighings').insert(remaining);
        if (remErr) throw remErr;
      }

      toast.success(`Ticket #${ticketNumber} criado com sucesso`);
      resetNewTicket();
      fetchWeighings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error('Erro ao criar ticket: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  const resetNewTicket = () => {
    setShowNewTicket(false);
    setSelectedClientId('');
    setClientSearch('');
    setVehiclePlate('');
    setTicketNotes('');
    setFractions([emptyFraction()]);
  };

  // ─── View ticket details ───
  const handleViewTicket = async (ticket: Weighing) => {
    setViewTicket(ticket);
    const { data } = await supabase
      .from('weighings')
      .select('*, clients(name, document_number, phone, whatsapp)')
      .eq('ticket_number', ticket.ticket_number)
      .order('created_at');
    setTicketFractions((data as Weighing[]) || []);
  };

  // ─── Insert into client_transactions when ticket concluded ───
  const insertTransactionForTicket = async (ticketNumber: number) => {
    const { data: rows } = await supabase
      .from('weighings')
      .select('*')
      .eq('ticket_number', ticketNumber);
    if (!rows || rows.length === 0) return;

    const sumByMaterial = (mat: string) =>
      rows.filter((r) => r.material_type === mat)
        .reduce((s, r) => s + Number(r.final_net_weight ?? r.net_weight ?? 0), 0);

    const totalKg = rows.reduce((s, r) => s + Number(r.final_net_weight ?? r.net_weight ?? 0), 0);
    const totalValue = rows.reduce((s, r) => s + Number(r.total_value ?? 0), 0);
    const avgPrice = totalKg > 0 ? totalValue / totalKg : 0;

    const { error } = await supabase.from('client_transactions').insert({
      client_id: rows[0].client_id,
      type: 'pesagem',
      description: `Ticket #${ticketNumber}`,
      amount: totalValue,
      status: 'aberto',
      transaction_date: rows[0].created_at,
      mista_kg: sumByMaterial('mista'),
      pesada_kg: sumByMaterial('pesada'),
      limaria_kg: sumByMaterial('limaria'),
      fundido_kg: sumByMaterial('fundido'),
      amortecedor_kg: sumByMaterial('amortecedor'),
      total_kg: totalKg,
      price_used: avgPrice,
      value: totalValue,
      ticket_number: ticketNumber,
      created_by: user?.id || null,
    });
    if (error) console.warn('client_transactions insert failed', error);
  };

  // ─── Close ticket (concluido) ───
  const handleCloseTicket = async (ticketNumber: number) => {
    const { error } = await supabase
      .from('weighings')
      .update({ status: 'concluido' })
      .eq('ticket_number', ticketNumber)
      .in('status', ['aberto', 'pesado']);
    if (error) {
      toast.error('Erro ao fechar ticket');
      return;
    }
    await insertTransactionForTicket(ticketNumber);
    toast.success(`Ticket #${ticketNumber} concluído e lançado na conta corrente`);
    fetchWeighings();
    setViewTicket(null);
  };

  // ─── Cancel ticket ───
  const handleCancelTicket = async (ticketNumber: number) => {
    const { error } = await supabase
      .from('weighings')
      .update({ status: 'cancelado' })
      .eq('ticket_number', ticketNumber);
    if (error) {
      toast.error('Erro ao cancelar ticket');
    } else {
      toast.success(`Ticket #${ticketNumber} cancelado`);
      fetchWeighings();
      setViewTicket(null);
    }
  };

  // ─── WhatsApp message ───
  const buildWhatsappUrl = (ticket: Weighing, rows: Weighing[]) => {
    const phone = (ticket.clients?.whatsapp || ticket.clients?.phone || '').replace(/\D/g, '');
    if (!phone) return null;
    const totalKg = rows.reduce((s, r) => s + Number(r.final_net_weight ?? r.net_weight ?? 0), 0);
    const totalValue = rows.reduce((s, r) => s + Number(r.total_value ?? 0), 0);
    const lines = rows.map((r) => {
      const fw = Number(r.final_net_weight ?? r.net_weight ?? 0);
      return `${getMaterialLabel(r.material_type)}: ${fw.toFixed(2)} kg × R$ ${Number(r.price_per_kg).toFixed(2)}/kg = R$ ${Number(r.total_value || 0).toFixed(2)}`;
    });
    const msg = `Olá ${ticket.clients?.name || ''}! 🏭
*Ticket #${ticket.ticket_number} - Sucata União*
Data: ${formatDateOnly(ticket.created_at)}
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
    const url = buildWhatsappUrl(viewTicket, ticketFractions);
    if (!url) {
      toast.error('Cliente sem telefone/WhatsApp cadastrado');
      return;
    }
    window.open(url, '_blank');
  };

  // ─── Print ─────────
  const handlePrint = () => window.print();

  // ─── Stats ───
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayWeighings = weighings.filter((w) => w.created_at.slice(0, 10) === todayStr && w.status !== 'cancelado');
  const totalWeightToday = todayWeighings.reduce((s, w) => s + Number(w.final_net_weight ?? w.net_weight ?? 0), 0);
  const totalValueToday = todayWeighings.reduce((s, w) => s + Number(w.total_value || 0), 0);
  const openTickets = weighings.filter((w) => w.status === 'aberto').length;

  const filteredClients = clients.filter((c) => {
    const t = clientSearch.toLowerCase();
    if (!t) return true;
    return (
      c.name.toLowerCase().includes(t) ||
      c.document_number.includes(t) ||
      (c.vehicle_plate || '').toLowerCase().includes(t)
    );
  });

  // Grand totals memo for fractions in dialog
  const ticketTotals = useMemo(() => {
    const totalKg = fractions.reduce((s, f) => s + calcFinalNet(f), 0);
    const totalValue = fractions.reduce((s, f) => s + calcSubtotal(f), 0);
    return { totalKg, totalValue };
  }, [fractions]);

  return (
    <div className="space-y-6">
      {/* Print-only styles */}
      <style>{`
        @media print {
          @page { margin: 0; size: 80mm auto; }
          body * { visibility: hidden; }
          #print-ticket, #print-ticket * { visibility: visible; }
          #print-ticket {
            position: absolute; left: 0; top: 0; width: 80mm;
            font-family: 'Courier New', monospace; font-size: 11px;
            color: #000; background: #fff; padding: 4mm;
          }
          .no-print { display: none !important; }
        }
        #print-ticket { display: none; }
        @media print { #print-ticket { display: block; } }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Scale className="h-7 w-7 text-primary" />
            Balança / Pesagem
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Controle de pesagens e tickets de balança rodoviária
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} lastRefreshAt={lastRefreshAt} />
          {/* TODO: integração WebSerial RS485 */}
          <Badge className="bg-yellow-400 text-yellow-950 hover:bg-yellow-400 gap-1">
            <Wifi className="h-3 w-3" />
            Balança: Manual
          </Badge>
          <Button onClick={() => setShowNewTicket(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Ticket
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><FileText className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Pesagens Hoje</p>
                <p className="text-xl font-bold text-foreground">{todayWeighings.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10"><Weight className="h-5 w-5 text-accent" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Peso Líquido Hoje</p>
                <p className="text-xl font-bold text-foreground">{formatWeight(totalWeightToday)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10"><Package className="h-5 w-5 text-success" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Valor Total Hoje</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(totalValueToday)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10"><Clock className="h-5 w-5 text-warning" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Tickets Abertos</p>
                <p className="text-xl font-bold text-foreground">{openTickets}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 no-print">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ticket, placa, cliente ou CPF/CNPJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="aberto">Ticket Aberto</SelectItem>
            <SelectItem value="pesado">Pesado</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
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
              <p className="text-xs mt-1">Crie um novo ticket para começar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">Ticket</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Tara</TableHead>
                  <TableHead className="text-right">Líquido Final</TableHead>
                  <TableHead className="text-right">R$/kg</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((w) => {
                  const st = STATUS_MAP[w.status] || { label: w.status, variant: 'secondary' as const };
                  const finalW = Number(w.final_net_weight ?? w.net_weight ?? 0);
                  return (
                    <TableRow key={w.id}>
                      <TableCell className="font-mono font-bold text-primary">#{w.ticket_number}</TableCell>
                      <TableCell className="font-medium">{w.clients?.name || '—'}</TableCell>
                      <TableCell>
                        {w.vehicle_plate ? (
                          <Badge variant="outline" className="font-mono">
                            <Truck className="h-3 w-3 mr-1" />
                            {w.vehicle_plate}
                          </Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell>{getMaterialLabel(w.material_type)}</TableCell>
                      <TableCell className="text-right font-mono">{formatWeight(w.gross_weight)}</TableCell>
                      <TableCell className="text-right font-mono">{formatWeight(w.tare_weight)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{formatWeight(finalW)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(w.price_per_kg)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{formatCurrency(w.total_value || 0)}</TableCell>
                      <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(w.created_at)}</TableCell>
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

      {/* ═══════ NEW TICKET DIALOG ═══════ */}
      <Dialog open={showNewTicket} onOpenChange={(open) => { if (!open) resetNewTicket(); else setShowNewTicket(true); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Novo Ticket de Pesagem
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Client */}
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
                    <button
                      key={c.id}
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
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {clientSearch}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedClientId(''); setClientSearch(''); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Placa do Veículo</Label>
              <Input
                placeholder="ABC-1D23"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                maxLength={8}
              />
            </div>

            <Separator />

            {/* Materials */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Materiais (Pesagem Fracionada)</Label>
                <Button variant="outline" size="sm" onClick={addFraction} className="gap-1">
                  <Plus className="h-3 w-3" />
                  Adicionar Material
                </Button>
              </div>

              {fractions.map((f, idx) => {
                const net = calcNet(f.gross_weight, f.tare_weight);
                const finalNet = calcFinalNet(f);
                const subtotal = calcSubtotal(f);
                return (
                  <Card key={idx} className="bg-muted/30">
                    <CardContent className="pt-4 pb-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Material #{idx + 1}</span>
                        {fractions.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => removeFraction(idx)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1 col-span-2 md:col-span-1">
                          <Label className="text-xs">Tipo de Material</Label>
                          <Select value={f.material_type} onValueChange={(v) => handleMaterialChange(idx, v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {MATERIAL_TYPES.map((m) => (
                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Peso Bruto (kg)</Label>
                          <Input type="number" step="0.01" placeholder="0,00"
                            value={f.gross_weight}
                            onChange={(e) => updateFraction(idx, { gross_weight: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Tara (kg)</Label>
                          <Input type="number" step="0.01" placeholder="0,00"
                            value={f.tare_weight}
                            onChange={(e) => updateFraction(idx, { tare_weight: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs flex items-center gap-1">
                            Preço/kg (R$)
                            {f.price_overridden && <Badge variant="outline" className="text-[9px] py-0 px-1">manual</Badge>}
                          </Label>
                          <Input type="number" step="0.01" placeholder="0,00"
                            value={f.price_per_kg}
                            onChange={(e) => handlePriceChange(idx, e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Discount */}
                      <div className="rounded-md border border-border/60 p-3 space-y-2 bg-background">
                        <Label className="text-xs font-semibold">Desconto de Impureza</Label>
                        <RadioGroup
                          value={f.discount_type}
                          onValueChange={(v) => updateFraction(idx, { discount_type: v as 'percent' | 'kg', discount_value: '' })}
                          className="flex gap-4"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="percent" id={`disc-pct-${idx}`} />
                            <Label htmlFor={`disc-pct-${idx}`} className="text-xs cursor-pointer">Percentual (%)</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="kg" id={`disc-kg-${idx}`} />
                            <Label htmlFor={`disc-kg-${idx}`} className="text-xs cursor-pointer">Em kg</Label>
                          </div>
                        </RadioGroup>
                        <div className="grid grid-cols-2 gap-3 items-end">
                          <Input
                            type="number" step="0.01"
                            placeholder={f.discount_type === 'percent' ? '0-100' : '0,00 kg'}
                            value={f.discount_value}
                            onChange={(e) => updateFraction(idx, { discount_value: e.target.value })}
                          />
                          <div className="text-xs text-muted-foreground">
                            Líquido: {formatWeight(net)} → <strong className="text-foreground">Peso Final: {formatWeight(finalNet)}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Photo */}
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="file" accept="image/*" capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handlePhotoUpload(idx, file);
                              e.target.value = '';
                            }}
                          />
                          <Button variant="outline" size="sm" asChild>
                            <span className="gap-1 inline-flex items-center">
                              <Camera className="h-3 w-3" />
                              {f.photo_uploading ? 'Enviando...' : 'Tirar Foto'}
                            </span>
                          </Button>
                        </label>
                        {f.photo_url && (
                          <a href={f.photo_url} target="_blank" rel="noreferrer">
                            <img src={f.photo_url} alt="Foto" className="h-12 w-12 object-cover rounded border" />
                          </a>
                        )}
                      </div>

                      <div className="flex gap-4 text-sm pt-1">
                        <span className="text-muted-foreground">
                          Subtotal: <strong className="text-accent">{formatCurrency(subtotal)}</strong>
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {fractions.length > 1 && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex justify-between items-center">
                  <span className="font-medium text-sm">Total Geral do Ticket</span>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{formatWeight(ticketTotals.totalKg)}</p>
                    <p className="font-bold text-lg text-primary">{formatCurrency(ticketTotals.totalValue)}</p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Observações sobre a pesagem..."
                value={ticketNotes}
                onChange={(e) => setTicketNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={resetNewTicket}>Cancelar</Button>
            <Button onClick={handleSaveTicket} disabled={saving} className="gap-2">
              {saving ? 'Salvando...' : (<><CheckCircle2 className="h-4 w-4" />Registrar Pesagem</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════ VIEW TICKET DIALOG ═══════ */}
      <Dialog open={!!viewTicket} onOpenChange={(open) => { if (!open) { setViewTicket(null); setTicketFractions([]); } }}>
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
                <div>
                  <p className="text-muted-foreground">Cliente</p>
                  <p className="font-medium">{viewTicket.clients?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">CPF/CNPJ</p>
                  <p className="font-mono">{viewTicket.clients?.document_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Placa</p>
                  <p className="font-mono">{viewTicket.vehicle_plate || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Data</p>
                  <p>{formatDate(viewTicket.created_at)}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="font-semibold text-sm">Materiais</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Bruto</TableHead>
                      <TableHead className="text-right">Tara</TableHead>
                      <TableHead className="text-right">Desconto</TableHead>
                      <TableHead className="text-right">Final</TableHead>
                      <TableHead className="text-right">R$/kg</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Foto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ticketFractions.map((f) => {
                      const dt = f.discount_type === 'percent'
                        ? `${Number(f.discount_value || 0).toFixed(2)}%`
                        : f.discount_type === 'kg'
                          ? `${Number(f.discount_value || 0).toFixed(2)} kg`
                          : '—';
                      return (
                        <TableRow key={f.id}>
                          <TableCell>{getMaterialLabel(f.material_type)}</TableCell>
                          <TableCell className="text-right font-mono">{formatWeight(f.gross_weight)}</TableCell>
                          <TableCell className="text-right font-mono">{formatWeight(f.tare_weight)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{dt}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {formatWeight(Number(f.final_net_weight ?? f.net_weight ?? 0))}
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(f.price_per_kg)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{formatCurrency(f.total_value || 0)}</TableCell>
                          <TableCell>
                            {f.photo_url ? (
                              <a href={f.photo_url} target="_blank" rel="noreferrer">
                                <img src={f.photo_url} alt="" className="h-8 w-8 object-cover rounded" />
                              </a>
                            ) : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {ticketFractions.length > 0 && (
                  <div className="flex justify-between items-center bg-primary/5 rounded-lg p-3">
                    <span className="font-medium">Total</span>
                    <div className="text-right">
                      <p className="text-sm">
                        {formatWeight(ticketFractions.reduce((s, f) => s + Number(f.final_net_weight ?? f.net_weight ?? 0), 0))}
                      </p>
                      <p className="font-bold text-primary">
                        {formatCurrency(ticketFractions.reduce((s, f) => s + Number(f.total_value || 0), 0))}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {viewTicket.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Observações</p>
                    <p className="text-sm">{viewTicket.notes}</p>
                  </div>
                </>
              )}

              <Separator />

              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="outline" onClick={handlePrint} className="gap-1">
                  <Printer className="h-4 w-4" />
                  Imprimir Ticket
                </Button>
                <Button variant="outline" onClick={handleSendWhatsapp} className="gap-1 text-green-700 border-green-200">
                  <MessageCircle className="h-4 w-4" />
                  Enviar WhatsApp
                </Button>
                {(viewTicket.status === 'aberto' || viewTicket.status === 'pesado') && (
                  <>
                    <Button variant="outline" onClick={() => handleCancelTicket(viewTicket.ticket_number)} className="gap-1 text-destructive">
                      <X className="h-4 w-4" />
                      Cancelar Ticket
                    </Button>
                    <Button onClick={() => handleCloseTicket(viewTicket.ticket_number)} className="gap-1">
                      <CheckCircle2 className="h-4 w-4" />
                      Concluir Ticket
                    </Button>
                  </>
                )}
                {viewTicket.status === 'concluido' && (
                  <Button variant="outline" onClick={() => handleCancelTicket(viewTicket.ticket_number)} className="gap-1 text-destructive">
                    <X className="h-4 w-4" />
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Print layout (hidden on screen) */}
          {viewTicket && (
            <div id="print-ticket">
              <div style={{ textAlign: 'center', fontWeight: 'bold' }}>
                ================================<br />
                SUCATA UNIÃO LTDA<br />
                WhatsApp: (31) 99653-5321<br />
                Santa Luzia - MG<br />
                Ticket #{viewTicket.ticket_number} - {formatDateOnly(viewTicket.created_at)}<br />
                ================================
              </div>
              <div style={{ marginTop: 6 }}>
                Cliente: {viewTicket.clients?.name}<br />
                Placa: {viewTicket.vehicle_plate || '-'}<br />
                --------------------------------
              </div>
              {ticketFractions.map((f) => {
                const dt = f.discount_type === 'percent'
                  ? `${Number(f.discount_value || 0).toFixed(2)}%`
                  : f.discount_type === 'kg'
                    ? `${Number(f.discount_value || 0).toFixed(2)} kg`
                    : '-';
                const fw = Number(f.final_net_weight ?? f.net_weight ?? 0);
                return (
                  <div key={f.id} style={{ marginTop: 4 }}>
                    <strong>{getMaterialLabel(f.material_type).toUpperCase()}</strong><br />
                    Peso Bruto:    {Number(f.gross_weight).toFixed(2)} kg<br />
                    Tara:          {Number(f.tare_weight).toFixed(2)} kg<br />
                    Desconto:      {dt}<br />
                    Peso Final:    {fw.toFixed(2)} kg<br />
                    Preço:         R$ {Number(f.price_per_kg).toFixed(2)}/kg<br />
                    Subtotal:      R$ {Number(f.total_value || 0).toFixed(2)}<br />
                    --------------------------------
                  </div>
                );
              })}
              <div style={{ marginTop: 4, fontWeight: 'bold' }}>
                TOTAL:         {ticketFractions.reduce((s, f) => s + Number(f.final_net_weight ?? f.net_weight ?? 0), 0).toFixed(2)} kg<br />
                VALOR TOTAL:   R$ {ticketFractions.reduce((s, f) => s + Number(f.total_value || 0), 0).toFixed(2)}<br />
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
