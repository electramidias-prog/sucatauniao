import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { toast } from 'sonner';
import {
  Plus, Search, Scale, Truck, FileText, Eye, Printer,
  CheckCircle2, Clock, Package, X, Trash2, Weight,
} from 'lucide-react';

// ─── Types ───
interface Client {
  id: string;
  name: string;
  document_number: string;
  vehicle_plate: string | null;
  client_type: string;
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
  clients?: { name: string; document_number: string };
}

interface FractionItem {
  material_type: string;
  gross_weight: string;
  tare_weight: string;
  price_per_kg: string;
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
  pago: { label: 'Pago', variant: 'default' },
  cancelado: { label: 'Cancelado', variant: 'destructive' },
};

export function BalancaPage() {
  const { user } = useAuth();
  const [weighings, setWeighings] = useState<Weighing[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  // New ticket dialog
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [ticketNotes, setTicketNotes] = useState('');

  // Fraction items for "Ticket Aberto" (multiple materials)
  const [fractions, setFractions] = useState<FractionItem[]>([
    { material_type: 'mista', gross_weight: '', tare_weight: '', price_per_kg: '' },
  ]);

  // View ticket dialog
  const [viewTicket, setViewTicket] = useState<Weighing | null>(null);
  const [ticketFractions, setTicketFractions] = useState<Weighing[]>([]);

  const [saving, setSaving] = useState(false);

  // ─── Fetch data ───
  const fetchWeighings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('weighings')
      .select('*, clients(name, document_number)')
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
      .select('id, name, document_number, vehicle_plate, client_type')
      .eq('status', 'ativo')
      .order('name');
    setClients(data || []);
  }, []);

  useEffect(() => {
    fetchWeighings();
    fetchClients();
  }, [fetchWeighings, fetchClients]);

  // ─── Helpers ───
  const formatWeight = (kg: number) => `${kg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg`;
  const formatCurrency = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (d: string) =>
    new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const getMaterialLabel = (val: string) =>
    MATERIAL_TYPES.find((m) => m.value === val)?.label || val;

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

  // Group by ticket_number for display (fractionated tickets share ticket_number)
  const ticketGroups = new Map<number, Weighing[]>();
  filtered.forEach((w) => {
    const group = ticketGroups.get(w.ticket_number) || [];
    group.push(w);
    ticketGroups.set(w.ticket_number, group);
  });

  // ─── Fraction management ───
  const addFraction = () => {
    setFractions((prev) => [
      ...prev,
      { material_type: 'mista', gross_weight: '', tare_weight: '', price_per_kg: '' },
    ]);
  };

  const removeFraction = (idx: number) => {
    if (fractions.length <= 1) return;
    setFractions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateFraction = (idx: number, field: keyof FractionItem, value: string) => {
    setFractions((prev) => prev.map((f, i) => (i === idx ? { ...f, [field]: value } : f)));
  };

  const calcNet = (gross: string, tare: string) => {
    const g = parseFloat(gross) || 0;
    const t = parseFloat(tare) || 0;
    return Math.max(0, g - t);
  };

  const calcTotal = (gross: string, tare: string, price: string) => {
    const net = calcNet(gross, tare);
    return net * (parseFloat(price) || 0);
  };

  // ─── Save ticket ───
  const handleSaveTicket = async () => {
    if (!selectedClientId) {
      toast.error('Selecione um cliente');
      return;
    }
    const validFractions = fractions.filter(
      (f) => parseFloat(f.gross_weight) > 0
    );
    if (validFractions.length === 0) {
      toast.error('Informe pelo menos um material com peso bruto');
      return;
    }

    setSaving(true);
    try {
      // All fractions in a ticket share the same ticket_number
      // The DB auto-increments ticket_number, so we insert the first one,
      // get the ticket_number, then insert remaining fractions with the same number
      const firstFraction = validFractions[0];
      const netW = calcNet(firstFraction.gross_weight, firstFraction.tare_weight);
      const totalV = calcTotal(firstFraction.gross_weight, firstFraction.tare_weight, firstFraction.price_per_kg);

      const { data: firstRow, error: firstErr } = await supabase
        .from('weighings')
        .insert({
          client_id: selectedClientId,
          vehicle_plate: vehiclePlate || null,
          material_type: firstFraction.material_type,
          gross_weight: parseFloat(firstFraction.gross_weight) || 0,
          tare_weight: parseFloat(firstFraction.tare_weight) || 0,
          net_weight: netW,
          price_per_kg: parseFloat(firstFraction.price_per_kg) || 0,
          total_value: totalV,
          status: validFractions.length > 1 ? 'aberto' : 'pesado',
          notes: ticketNotes || null,
          created_by: user?.id || null,
        })
        .select('ticket_number')
        .single();

      if (firstErr) throw firstErr;

      // Insert remaining fractions with same ticket_number
      if (validFractions.length > 1) {
        const remaining = validFractions.slice(1).map((f) => {
          const n = calcNet(f.gross_weight, f.tare_weight);
          return {
            client_id: selectedClientId,
            vehicle_plate: vehiclePlate || null,
            material_type: f.material_type,
            gross_weight: parseFloat(f.gross_weight) || 0,
            tare_weight: parseFloat(f.tare_weight) || 0,
            net_weight: n,
            price_per_kg: parseFloat(f.price_per_kg) || 0,
            total_value: n * (parseFloat(f.price_per_kg) || 0),
            status: 'aberto',
            notes: ticketNotes || null,
            created_by: user?.id || null,
            ticket_number: firstRow.ticket_number,
          };
        });

        const { error: remErr } = await supabase.from('weighings').insert(remaining);
        if (remErr) throw remErr;
      }

      toast.success(`Ticket #${firstRow.ticket_number} criado com sucesso`);
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
    setFractions([{ material_type: 'mista', gross_weight: '', tare_weight: '', price_per_kg: '' }]);
  };

  // ─── View ticket details ───
  const handleViewTicket = async (ticket: Weighing) => {
    setViewTicket(ticket);
    const { data } = await supabase
      .from('weighings')
      .select('*, clients(name, document_number)')
      .eq('ticket_number', ticket.ticket_number)
      .order('created_at');
    setTicketFractions((data as Weighing[]) || []);
  };

  // ─── Close ticket (mark as pesado) ───
  const handleCloseTicket = async (ticketNumber: number) => {
    const { error } = await supabase
      .from('weighings')
      .update({ status: 'pesado' })
      .eq('ticket_number', ticketNumber)
      .eq('status', 'aberto');
    if (error) {
      toast.error('Erro ao fechar ticket');
    } else {
      toast.success(`Ticket #${ticketNumber} fechado`);
      fetchWeighings();
      setViewTicket(null);
    }
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

  // ─── Stats ───
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayWeighings = weighings.filter((w) => w.created_at.slice(0, 10) === todayStr);
  const totalWeightToday = todayWeighings.reduce((s, w) => s + (w.net_weight || 0), 0);
  const totalValueToday = todayWeighings.reduce((s, w) => s + (w.total_value || 0), 0);
  const openTickets = weighings.filter((w) => w.status === 'aberto').length;

  // Filter clients for selection
  const filteredClients = clients.filter((c) => {
    const t = clientSearch.toLowerCase();
    if (!t) return true;
    return (
      c.name.toLowerCase().includes(t) ||
      c.document_number.includes(t) ||
      (c.vehicle_plate || '').toLowerCase().includes(t)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Scale className="h-7 w-7 text-primary" />
            Balança / Pesagem
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Controle de pesagens e tickets de balança rodoviária
          </p>
        </div>
        <Button onClick={() => setShowNewTicket(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Ticket
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
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
              <div className="p-2 rounded-lg bg-accent/10">
                <Weight className="h-5 w-5 text-accent" />
              </div>
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
              <div className="p-2 rounded-lg bg-success/10">
                <Package className="h-5 w-5 text-success" />
              </div>
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
              <div className="p-2 rounded-lg bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tickets Abertos</p>
                <p className="text-xl font-bold text-foreground">{openTickets}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
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
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="aberto">Ticket Aberto</SelectItem>
            <SelectItem value="pesado">Pesado</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
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
                  <TableHead className="text-right">Líquido</TableHead>
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
                  return (
                    <TableRow key={w.id}>
                      <TableCell className="font-mono font-bold text-primary">
                        #{w.ticket_number}
                      </TableCell>
                      <TableCell className="font-medium">
                        {w.clients?.name || '—'}
                      </TableCell>
                      <TableCell>
                        {w.vehicle_plate ? (
                          <Badge variant="outline" className="font-mono">
                            <Truck className="h-3 w-3 mr-1" />
                            {w.vehicle_plate}
                          </Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell>{getMaterialLabel(w.material_type)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatWeight(w.gross_weight)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatWeight(w.tare_weight)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatWeight(w.net_weight || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(w.price_per_kg)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatCurrency(w.total_value || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(w.created_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewTicket(w)}
                        >
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
      <Dialog open={showNewTicket} onOpenChange={(open) => { if (!open) resetNewTicket(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Novo Ticket de Pesagem
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Client Selection */}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSelectedClientId(''); setClientSearch(''); }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* Vehicle Plate */}
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

            {/* Materials (Fractions) */}
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
                const total = calcTotal(f.gross_weight, f.tare_weight, f.price_per_kg);
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
                          <Select
                            value={f.material_type}
                            onValueChange={(v) => updateFraction(idx, 'material_type', v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MATERIAL_TYPES.map((m) => (
                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Peso Bruto (kg)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0,00"
                            value={f.gross_weight}
                            onChange={(e) => updateFraction(idx, 'gross_weight', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Tara (kg)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0,00"
                            value={f.tare_weight}
                            onChange={(e) => updateFraction(idx, 'tare_weight', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Preço/kg (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0,00"
                            value={f.price_per_kg}
                            onChange={(e) => updateFraction(idx, 'price_per_kg', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex gap-4 text-sm pt-1">
                        <span className="text-muted-foreground">
                          Líquido: <strong className="text-foreground">{formatWeight(net)}</strong>
                        </span>
                        <span className="text-muted-foreground">
                          Total: <strong className="text-accent">{formatCurrency(total)}</strong>
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Grand total */}
              {fractions.length > 1 && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex justify-between items-center">
                  <span className="font-medium text-sm">Total Geral do Ticket</span>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {formatWeight(fractions.reduce((s, f) => s + calcNet(f.gross_weight, f.tare_weight), 0))}
                    </p>
                    <p className="font-bold text-lg text-primary">
                      {formatCurrency(fractions.reduce((s, f) => s + calcTotal(f.gross_weight, f.tare_weight, f.price_per_kg), 0))}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Notes */}
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
              {saving ? 'Salvando...' : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Registrar Pesagem
                </>
              )}
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
                      <TableHead className="text-right">Líquido</TableHead>
                      <TableHead className="text-right">R$/kg</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ticketFractions.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>{getMaterialLabel(f.material_type)}</TableCell>
                        <TableCell className="text-right font-mono">{formatWeight(f.gross_weight)}</TableCell>
                        <TableCell className="text-right font-mono">{formatWeight(f.tare_weight)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{formatWeight(f.net_weight || 0)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(f.price_per_kg)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{formatCurrency(f.total_value || 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {ticketFractions.length > 1 && (
                  <div className="flex justify-between items-center bg-primary/5 rounded-lg p-3">
                    <span className="font-medium">Total</span>
                    <div className="text-right">
                      <p className="text-sm">
                        {formatWeight(ticketFractions.reduce((s, f) => s + (f.net_weight || 0), 0))}
                      </p>
                      <p className="font-bold text-primary">
                        {formatCurrency(ticketFractions.reduce((s, f) => s + (f.total_value || 0), 0))}
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

              <div className="flex gap-2 justify-end">
                {viewTicket.status === 'aberto' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handleCancelTicket(viewTicket.ticket_number)}
                      className="gap-1 text-destructive"
                    >
                      <X className="h-4 w-4" />
                      Cancelar Ticket
                    </Button>
                    <Button
                      onClick={() => handleCloseTicket(viewTicket.ticket_number)}
                      className="gap-1"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Fechar Ticket
                    </Button>
                  </>
                )}
                {viewTicket.status === 'pesado' && (
                  <Button
                    variant="outline"
                    onClick={() => handleCancelTicket(viewTicket.ticket_number)}
                    className="gap-1 text-destructive"
                  >
                    <X className="h-4 w-4" />
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
