import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Printer, Plus, Scale, Settings2, FileText, DollarSign } from 'lucide-react';
import { ClientSearchInline, type SelectedClient } from './balanca/ClientSearchInline';
import { ReopenTicketDialog } from './balanca/ReopenTicketDialog';
import { DefaultTareDialog } from './balanca/DefaultTareDialog';
import { GenerateInvoiceDialog } from './balanca/GenerateInvoiceDialog';
import { printReceipt } from './balanca/ThermalReceipt';
import { ExportButton } from './balanca/exportTable';
import { logAudit } from './balanca/auditLog';
import { PhotoField } from './balanca/PhotoField';
import { PhotoThumb, PhotoViewDialog } from './balanca/PhotoViewDialog';
import { getTarifaPesagem, type TarifaPesagem } from '@/lib/tarifaPesagem';

interface PaidWeighing {
  id: string;
  type: 'avulsa' | 'cadastrada';
  client_id: string | null;
  vehicle_plate: string;
  gross_weight: number | null;
  tare_weight: number | null;
  net_weight: number | null;
  entry_at: string;
  exit_at: string | null;
  status: 'em_aberto' | 'finalizado' | 'encerrado_automatico' | 'reaberto';
  payment_status: 'pago' | 'nao_pago';
  payment_at: string | null;
  total_amount: number | null;
  tarifa_aplicada: number | null;
  tarifa_origem: 'global' | 'customizada' | null;
  notes: string | null;
  invoice_id: string | null;
  photo_url: string | null;
  clients?: { name: string; document_number: string } | null;
}

const fmtKg = (n: number | null | undefined) =>
  `${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;
const fmtBRL = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDT = (s: string) => new Date(s).toLocaleString('pt-BR');

function elapsed(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return { h, m, label: `${h}h ${m}m`, danger: h >= 20 };
}

export function PesagensPagasTab() {
  const [items, setItems] = useState<PaidWeighing[]>([]);
  const [, force] = useState(0);
  const [reopenId, setReopenId] = useState<string | null>(null);
  const [payTicket, setPayTicket] = useState<PaidWeighing | null>(null);
  const [exitTicket, setExitTicket] = useState<PaidWeighing | null>(null);
  const [viewPhotoUrl, setViewPhotoUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('paid_weighings')
      .select('*,clients(name,document_number)')
      .order('entry_at', { ascending: false })
      .limit(500);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((data as any) || []);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel('paid_weighings_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paid_weighings' }, () => load())
      .subscribe();
    const tick = setInterval(() => force(x => x + 1), 60000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(tick);
    };
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const todayItems = items.filter(i => i.entry_at.slice(0, 10) === today);
  const cash = {
    total: todayItems.length,
    paid: todayItems.filter(i => i.payment_status === 'pago').length,
    paidValue: todayItems
      .filter(i => i.payment_status === 'pago')
      .reduce((a, i) => a + Number(i.total_amount || 0), 0),
    pending: todayItems
      .filter(i => i.payment_status === 'nao_pago' && (i.status === 'finalizado' || i.status === 'encerrado_automatico'))
      .reduce((a, i) => a + Number(i.total_amount || 0), 0),
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<Scale className="h-4 w-4" />} label="Pesagens Hoje" value={String(cash.total)} />
        <Stat icon={<FileText className="h-4 w-4" />} label="Quitadas" value={String(cash.paid)} />
        <Stat icon={<DollarSign className="h-4 w-4" />} label="Total Quitado" value={fmtBRL(cash.paidValue)} positive />
        <Stat icon={<DollarSign className="h-4 w-4" />} label="Inadimplente" value={fmtBRL(cash.pending)} danger />
      </div>

      <Tabs defaultValue="avulsa">
        <TabsList>
          <TabsTrigger value="avulsa">Avulsa</TabsTrigger>
          <TabsTrigger value="cadastrada">Cadastrada</TabsTrigger>
        </TabsList>
        <TabsContent value="avulsa" className="mt-3">
          <AvulsaSection items={items} onReload={load} onReopen={setReopenId} onPay={setPayTicket} onExit={setExitTicket} onViewPhoto={setViewPhotoUrl} />
        </TabsContent>
        <TabsContent value="cadastrada" className="mt-3">
          <CadastradaSection items={items} onReload={load} onReopen={setReopenId} onPay={setPayTicket} onExit={setExitTicket} onViewPhoto={setViewPhotoUrl} />
        </TabsContent>
      </Tabs>

      {reopenId && (
        <ReopenTicketDialog
          open={!!reopenId}
          onOpenChange={v => !v && setReopenId(null)}
          ticketId={reopenId}
          onDone={load}
        />
      )}
      {payTicket && <PayDialog ticket={payTicket} onClose={() => setPayTicket(null)} onDone={load} />}
      {exitTicket && <ExitDialog ticket={exitTicket} onClose={() => setExitTicket(null)} onDone={load} />}
      <PhotoViewDialog url={viewPhotoUrl} onClose={() => setViewPhotoUrl(null)} />
    </div>
  );
}

function Stat({ icon, label, value, positive, danger }: { icon: React.ReactNode; label: string; value: string; positive?: boolean; danger?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-3 pb-3 flex items-center gap-3">
        <div className={`p-2 rounded ${danger ? 'bg-red-600/10 text-red-600' : positive ? 'bg-green-600/10 text-green-600' : 'bg-gray-950/5'}`}>{icon}</div>
        <div>
          <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
          <p className={`text-lg font-bold ${danger ? 'text-red-600' : positive ? 'text-green-600' : ''}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────── AVULSA ───────────
function AvulsaSection({
  items, onReload, onReopen, onPay, onExit, onViewPhoto,
}: {
  items: PaidWeighing[];
  onReload: () => void;
  onReopen: (id: string) => void;
  onPay: (t: PaidWeighing) => void;
  onExit: (t: PaidWeighing) => void;
  onViewPhoto: (url: string) => void;
}) {
  const [client, setClient] = useState<SelectedClient | null>(null);
  const [plate, setPlate] = useState('');
  const [gross, setGross] = useState('');
  const [price, setPrice] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!client || !plate || !gross || !price) {
      toast.error('Preencha cliente, placa, peso e preço');
      return;
    }
    setBusy(true);
    const payload = {
      type: 'avulsa' as const,
      client_id: client.id,
      vehicle_plate: plate.toUpperCase(),
      gross_weight: Number(gross),
      price_per_kg: Number(price),
      photo_url: photoUrl || null,
    };
    const { data, error } = await supabase.from('paid_weighings').insert(payload as any).select('*,clients(name,document_number)').single();
    setBusy(false);
    if (error || !data) {
      toast.error('Erro: ' + (error?.message || ''));
      return;
    }
    await logAudit({ table: 'paid_weighings', recordId: (data as any).id, action: 'INSERT', newValue: payload });
    toast.success('Entrada registrada');
    printReceipt({
      ticketId: (data as any).id,
      type: 'avulsa',
      clientName: client.name,
      clientDocument: client.document_number,
      vehiclePlate: plate.toUpperCase(),
      entryAt: (data as any).entry_at,
      grossWeight: Number(gross),
      pricePerKg: Number(price),
      paymentStatus: 'nao_pago',
    });
    setClient(null);
    setPlate('');
    setGross('');
    setPrice('');
    setPhotoUrl(null);
    onReload();
  };

  const avulsa = items.filter(i => i.type === 'avulsa');
  const today = new Date().toISOString().slice(0, 10);
  const open = avulsa.filter(i => i.status === 'em_aberto' || i.status === 'reaberto');
  const autoClosed = avulsa.filter(i => i.status === 'encerrado_automatico');
  const finalizedToday = avulsa.filter(i => i.status === 'finalizado' && (i.exit_at || i.entry_at).slice(0, 10) === today);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2"><Plus className="h-4 w-4" /> Nova Pesagem Avulsa</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2"><ClientSearchInline value={client} onChange={setClient} /></div>
            <div>
              <Label className="text-xs">Placa</Label>
              <Input value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} className="uppercase" />
            </div>
            <div>
              <Label className="text-xs">Peso Entrada (kg)</Label>
              <Input type="number" step="0.001" value={gross} onChange={e => setGross(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Preço/kg (R$)</Label>
              <Input type="number" step="0.0001" value={price} onChange={e => setPrice(e.target.value)} />
            </div>
          </div>
          <Button onClick={submit} disabled={busy} className="bg-red-600 hover:bg-red-700">
            <Plus className="h-4 w-4 mr-1" /> {busy ? 'Registrando…' : 'Registrar Entrada'}
          </Button>
          <div>
            <Label className="text-xs">Foto da carga (opcional)</Label>
            <PhotoField value={photoUrl} onChange={setPhotoUrl} folder="paid-avulsa" />
          </div>
        </CardContent>
      </Card>

      <OpenTable title="Tickets Avulsos em Aberto" items={open} onReopen={onReopen} onPay={onPay} onExit={onExit} onViewPhoto={onViewPhoto} />

      {autoClosed.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <h3 className="font-semibold text-sm mb-2">Encerrados Automaticamente</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Ticket</TableHead>
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs">Placa</TableHead>
                  <TableHead className="text-xs">Entrada</TableHead>
                  <TableHead className="text-xs">Peso</TableHead>
                  <TableHead className="text-xs"></TableHead>
                  <TableHead className="text-xs">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {autoClosed.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="text-[13px] font-mono">{t.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-[13px]">{t.clients?.name ?? '-'}</TableCell>
                    <TableCell className="text-[13px]">{t.vehicle_plate}</TableCell>
                    <TableCell className="text-xs">{fmtDT(t.entry_at)}</TableCell>
                    <TableCell className="text-xs">{fmtKg(t.gross_weight)}</TableCell>
                    <TableCell><Badge className="bg-red-600 text-white">Encerrado automaticamente — 24h</Badge></TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => onReopen(t.id)}>Reabrir</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <FinalizedTable title="Finalizados do Dia (Avulsa)" items={finalizedToday} onViewPhoto={onViewPhoto} />
    </div>
  );
}

// ─────────── CADASTRADA ───────────
function CadastradaSection({
  items, onReload, onReopen, onPay, onExit, onViewPhoto,
}: {
  items: PaidWeighing[];
  onReload: () => void;
  onReopen: (id: string) => void;
  onPay: (t: PaidWeighing) => void;
  onExit: (t: PaidWeighing) => void;
  onViewPhoto: (url: string) => void;
}) {
  const [companies, setCompanies] = useState<{ id: string; name: string; document_number: string }[]>([]);
  const [tareDialog, setTareDialog] = useState<{ id: string; name: string } | null>(null);
  const [invoiceDialog, setInvoiceDialog] = useState<{ id: string; name: string } | null>(null);
  const [newDialog, setNewDialog] = useState<{ id: string; name: string; document_number: string } | null>(null);

  const loadCompanies = useCallback(async () => {
    const ids = new Set<string>();
    items.filter(i => i.type === 'cadastrada' && i.client_id).forEach(i => ids.add(i.client_id!));
    const { data: tares } = await supabase.from('client_default_tares').select('client_id');
    (tares as any[] | null)?.forEach(t => ids.add(t.client_id));
    if (ids.size === 0) {
      setCompanies([]);
      return;
    }
    const { data } = await supabase
      .from('clients')
      .select('id,name,document_number')
      .in('id', Array.from(ids));
    setCompanies(((data as any) || []) as any);
  }, [items]);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  const cadastrada = items.filter(i => i.type === 'cadastrada');
  const today = new Date().toISOString().slice(0, 10);
  const open = cadastrada.filter(i => i.status === 'em_aberto' || i.status === 'reaberto');
  const finalizedToday = cadastrada.filter(i => i.status === 'finalizado' && (i.exit_at || i.entry_at).slice(0, 10) === today);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Empresas Cadastradas</h3>
            <CompanyPickerButton onPicked={c => setNewDialog(c)} />
          </div>
          {companies.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma empresa cadastrada — use "Nova Empresa" para iniciar.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {companies.map(c => (
                <div key={c.id} className="border rounded p-2 text-sm flex flex-col gap-2">
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.document_number}</div>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 h-7 text-xs" onClick={() => setNewDialog(c)}>
                      <Plus className="h-3 w-3 mr-1" /> Nova Pesagem
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setTareDialog(c)}>
                      <Settings2 className="h-3 w-3 mr-1" /> Tara
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setInvoiceDialog(c)}>
                      <FileText className="h-3 w-3 mr-1" /> Faturar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <OpenTable title="Pesagens Cadastradas em Aberto" items={open} onReopen={onReopen} onPay={onPay} onExit={onExit} onViewPhoto={onViewPhoto} />
      <FinalizedTable title="Finalizadas do Dia (Cadastrada)" items={finalizedToday} onViewPhoto={onViewPhoto} />

      {tareDialog && (
        <DefaultTareDialog
          open={!!tareDialog}
          onOpenChange={v => !v && setTareDialog(null)}
          clientId={tareDialog.id}
          clientName={tareDialog.name}
          onSaved={loadCompanies}
        />
      )}
      {invoiceDialog && (
        <GenerateInvoiceDialog
          open={!!invoiceDialog}
          onOpenChange={v => !v && setInvoiceDialog(null)}
          clientId={invoiceDialog.id}
          clientName={invoiceDialog.name}
          onDone={onReload}
        />
      )}
      {newDialog && (
        <NewCadastradaDialog client={newDialog} onClose={() => setNewDialog(null)} onDone={() => { onReload(); loadCompanies(); }} />
      )}
    </div>
  );
}

function CompanyPickerButton({ onPicked }: { onPicked: (c: { id: string; name: string; document_number: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<SelectedClient | null>(null);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-3 w-3 mr-1" /> Nova Empresa
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Selecionar Empresa</DialogTitle></DialogHeader>
          <ClientSearchInline value={sel} onChange={setSel} label="Empresa" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              disabled={!sel}
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { if (sel) { onPicked(sel); setSel(null); setOpen(false); } }}
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewCadastradaDialog({
  client, onClose, onDone,
}: {
  client: { id: string; name: string; document_number: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [plate, setPlate] = useState('');
  const [gross, setGross] = useState('');
  const [tare, setTare] = useState('');
  const [price, setPrice] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('client_default_tares')
        .select('tare_weight')
        .eq('client_id', client.id)
        .maybeSingle();
      if (data) setTare(String((data as any).tare_weight ?? ''));
    })();
  }, [client.id]);

  const submit = async () => {
    if (!plate || !gross || !price) {
      toast.error('Preencha placa, peso e preço');
      return;
    }
    setBusy(true);
    const payload = {
      type: 'cadastrada' as const,
      client_id: client.id,
      vehicle_plate: plate.toUpperCase(),
      gross_weight: Number(gross),
      tare_weight: tare ? Number(tare) : null,
      price_per_kg: Number(price),
      photo_url: photoUrl || null,
    };
    const { data, error } = await supabase.from('paid_weighings').insert(payload as any).select().single();
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message || 'Erro');
      return;
    }
    await logAudit({ table: 'paid_weighings', recordId: (data as any).id, action: 'INSERT', newValue: payload });
    toast.success('Entrada registrada');
    printReceipt({
      ticketId: (data as any).id,
      type: 'cadastrada',
      clientName: client.name,
      clientDocument: client.document_number,
      vehiclePlate: plate.toUpperCase(),
      entryAt: (data as any).entry_at,
      grossWeight: Number(gross),
      tareWeight: tare ? Number(tare) : null,
      pricePerKg: Number(price),
      paymentStatus: 'nao_pago',
    });
    onDone();
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nova Pesagem — {client.name}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label className="text-xs">Placa</Label><Input value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} /></div>
          <div><Label className="text-xs">Peso Entrada (kg)</Label><Input type="number" step="0.001" value={gross} onChange={e => setGross(e.target.value)} /></div>
          <div><Label className="text-xs">Tara (kg)</Label><Input type="number" step="0.001" value={tare} onChange={e => setTare(e.target.value)} /></div>
          <div><Label className="text-xs">Preço/kg (R$)</Label><Input type="number" step="0.0001" value={price} onChange={e => setPrice(e.target.value)} /></div>
          <div className="col-span-2">
            <Label className="text-xs">Foto da carga (opcional)</Label>
            <PhotoField value={photoUrl} onChange={setPhotoUrl} folder="paid-cadastrada" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={busy} className="bg-red-600 hover:bg-red-700">{busy ? 'Salvando…' : 'Registrar Entrada'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────── shared tables ───────────
function OpenTable({
  title, items, onReopen, onPay, onExit, onViewPhoto,
}: {
  title: string;
  items: PaidWeighing[];
  onReopen: (id: string) => void;
  onPay: (t: PaidWeighing) => void;
  onExit: (t: PaidWeighing) => void;
  onViewPhoto: (url: string) => void;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <h3 className="font-semibold text-sm mb-2">{title}</h3>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum ticket em aberto.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Ticket</TableHead>
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs">Placa</TableHead>
                  <TableHead className="text-xs">Entrada</TableHead>
                  <TableHead className="text-xs text-right">Peso</TableHead>
                  <TableHead className="text-xs">Tempo Aberto</TableHead>
                  <TableHead className="text-xs">Pagamento</TableHead>
                  <TableHead className="text-xs">Foto</TableHead>
                  <TableHead className="text-xs">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(t => {
                  const e = elapsed(t.entry_at);
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="text-[13px] font-mono py-1.5">{t.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-[13px] py-1.5">{t.clients?.name ?? '-'}</TableCell>
                      <TableCell className="text-[13px] py-1.5">{t.vehicle_plate}</TableCell>
                      <TableCell className="text-xs py-1.5">{fmtDT(t.entry_at)}</TableCell>
                      <TableCell className="text-xs py-1.5 text-right">{fmtKg(t.gross_weight)}</TableCell>
                      <TableCell className={`text-xs py-1.5 ${e.danger ? 'bg-red-600 text-white font-bold' : ''}`}>{e.label}</TableCell>
                      <TableCell className="py-1.5">
                        {t.payment_status === 'pago'
                          ? <Badge className="bg-green-600 text-white">Pago</Badge>
                          : <Badge variant="outline" className="border-red-600 text-red-600">Não Pago</Badge>}
                      </TableCell>
                      <TableCell className="py-1.5"><PhotoThumb url={t.photo_url} onOpen={onViewPhoto} /></TableCell>
                      <TableCell className="py-1.5">
                        <div className="flex gap-1">
                          {t.payment_status === 'nao_pago' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onPay(t)}>Pagar</Button>
                          )}
                          <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700" onClick={() => onExit(t)}>Saída</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onReopen(t.id)}>Reabrir</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FinalizedTable({ title, items, onViewPhoto }: { title: string; items: PaidWeighing[]; onViewPhoto: (url: string) => void }) {
  const headers = ['Ticket', 'Cliente', 'Doc', 'Placa', 'Entrada', 'Saída', 'Bruto (kg)', 'Tara (kg)', 'Líquido (kg)', 'Preço/kg', 'Total (R$)', 'Pagamento', 'Foto'];
  const rows = items.map(t => [
    t.id.slice(0, 8),
    t.clients?.name ?? '-',
    t.clients?.document_number ?? '-',
    t.vehicle_plate,
    fmtDT(t.entry_at),
    t.exit_at ? fmtDT(t.exit_at) : '-',
    Number(t.gross_weight || 0).toFixed(3),
    Number(t.tare_weight || 0).toFixed(3),
    Number(t.net_weight || 0).toFixed(3),
    Number(t.price_per_kg || 0).toFixed(4),
    Number(t.total_amount || 0).toFixed(2),
    t.payment_status === 'pago' ? 'PAGO' : 'NÃO PAGO',
    t.photo_url ? t.photo_url : '-',
  ]);

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">{title}</h3>
          <ExportButton filenameBase={title} headers={headers} rows={rows} disabled={items.length === 0} />
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum registro hoje.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>{headers.map(h => <TableHead key={h} className="text-xs">{h}</TableHead>)}</TableRow>
              </TableHeader>
              <TableBody>
                {items.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="text-[13px] font-mono py-1.5">{t.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-[13px] py-1.5">{t.clients?.name ?? '-'}</TableCell>
                    <TableCell className="text-xs py-1.5">{t.clients?.document_number ?? '-'}</TableCell>
                    <TableCell className="text-[13px] py-1.5">{t.vehicle_plate}</TableCell>
                    <TableCell className="text-xs py-1.5">{fmtDT(t.entry_at)}</TableCell>
                    <TableCell className="text-xs py-1.5">{t.exit_at ? fmtDT(t.exit_at) : '-'}</TableCell>
                    <TableCell className="text-xs py-1.5 text-right">{fmtKg(t.gross_weight)}</TableCell>
                    <TableCell className="text-xs py-1.5 text-right">{fmtKg(t.tare_weight)}</TableCell>
                    <TableCell className="text-xs py-1.5 text-right font-semibold">{fmtKg(t.net_weight)}</TableCell>
                    <TableCell className="text-xs py-1.5 text-right">{fmtBRL(t.price_per_kg)}</TableCell>
                    <TableCell className="text-xs py-1.5 text-right font-semibold">{fmtBRL(t.total_amount)}</TableCell>
                    <TableCell className="py-1.5">
                      {t.payment_status === 'pago'
                        ? <Badge className="bg-green-600 text-white">Pago</Badge>
                        : <Badge variant="outline" className="border-red-600 text-red-600">Não Pago</Badge>}
                    </TableCell>
                    <TableCell className="py-1.5"><PhotoThumb url={t.photo_url} onOpen={onViewPhoto} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────── action dialogs ───────────
function PayDialog({ ticket, onClose, onDone }: { ticket: PaidWeighing; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const liquido = (Number(ticket.gross_weight) || 0) - (Number(ticket.tare_weight) || 0);
  const total = liquido * (Number(ticket.price_per_kg) || 0);
  const submit = async () => {
    setBusy(true);
    const updates: any = { payment_status: 'pago', payment_at: new Date().toISOString() };
    if (!ticket.total_amount) updates.total_amount = total;
    const { error } = await supabase.from('paid_weighings').update(updates).eq('id', ticket.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({ table: 'paid_weighings', recordId: ticket.id, action: 'UPDATE', oldValue: { payment_status: ticket.payment_status }, newValue: updates });
    toast.success('Pagamento registrado');
    onDone();
    onClose();
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
        <div className="text-sm space-y-1">
          <div>Cliente: <strong>{ticket.clients?.name ?? '-'}</strong></div>
          <div>Placa: <strong>{ticket.vehicle_plate}</strong></div>
          <div>Peso: {fmtKg(ticket.gross_weight)}</div>
          <div className="text-lg pt-2">Valor: <span className="font-bold text-green-600">{fmtBRL(ticket.total_amount || total)}</span></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={busy} className="bg-green-600 hover:bg-green-700">{busy ? 'Salvando…' : 'Confirmar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExitDialog({ ticket, onClose, onDone }: { ticket: PaidWeighing; onClose: () => void; onDone: () => void }) {
  const [tare, setTare] = useState(String(ticket.tare_weight ?? ''));
  const [photoUrl, setPhotoUrl] = useState<string | null>(ticket.photo_url ?? null);
  const [busy, setBusy] = useState(false);
  const liquido = (Number(ticket.gross_weight) || 0) - (Number(tare) || 0);
  const total = liquido * (Number(ticket.price_per_kg) || 0);
  const submit = async () => {
    if (!tare) {
      toast.error('Informe a tara');
      return;
    }
    setBusy(true);
    const updates: any = {
      tare_weight: Number(tare),
      total_amount: total,
      exit_at: new Date().toISOString(),
      status: 'finalizado' as const,
    };
    if (photoUrl !== ticket.photo_url) updates.photo_url = photoUrl || null;
    const { error } = await supabase.from('paid_weighings').update(updates as any).eq('id', ticket.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({ table: 'paid_weighings', recordId: ticket.id, action: 'UPDATE', oldValue: { status: ticket.status }, newValue: updates });
    toast.success('Saída registrada');
    printReceipt({
      ticketId: ticket.id,
      type: ticket.type,
      clientName: ticket.clients?.name,
      clientDocument: ticket.clients?.document_number,
      vehiclePlate: ticket.vehicle_plate,
      entryAt: ticket.entry_at,
      grossWeight: Number(ticket.gross_weight),
      tareWeight: Number(tare),
      netWeight: liquido,
      pricePerKg: Number(ticket.price_per_kg),
      totalAmount: total,
      paymentStatus: ticket.payment_status,
      finalized: true,
    });
    onDone();
    onClose();
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Registrar Saída</DialogTitle></DialogHeader>
        <div className="space-y-2 text-sm">
          <div>Peso Entrada: <strong>{fmtKg(ticket.gross_weight)}</strong></div>
          <div>
            <Label className="text-xs">Tara (kg) *</Label>
            <Input type="number" step="0.001" value={tare} onChange={e => setTare(e.target.value)} />
          </div>
          <div>Líquido: <strong>{fmtKg(liquido)}</strong></div>
          <div>Total: <strong className="text-green-600">{fmtBRL(total)}</strong></div>
          <div>
            <Label className="text-xs">Foto da carga (opcional)</Label>
            <PhotoField value={photoUrl} onChange={setPhotoUrl} folder="paid-exit" recordId={ticket.id} recordTable="paid_weighings" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={busy} className="bg-red-600 hover:bg-red-700"><Printer className="h-4 w-4 mr-1" />{busy ? 'Salvando…' : 'Finalizar e Imprimir'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}