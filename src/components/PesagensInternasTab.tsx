import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { ExportButton } from './balanca/exportTable';
import { logAudit } from './balanca/auditLog';

interface Employee {
  id: string;
  full_name: string;
  role_title: string | null;
}

interface InternalWeighing {
  id: string;
  employee_id: string;
  vehicle_plate: string;
  gross_weight: number | null;
  tare_weight: number | null;
  net_weight: number | null;
  entry_at: string;
  exit_at: string | null;
  status: 'em_aberto' | 'finalizado';
  destination: string | null;
  notes: string | null;
  employees?: { full_name: string; role_title: string | null } | null;
}

const fmtKg = (n: number | null | undefined) =>
  `${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;
const fmtDT = (s: string) => new Date(s).toLocaleString('pt-BR');

export function PesagensInternasTab() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [plates, setPlates] = useState<string[]>([]);
  const [items, setItems] = useState<InternalWeighing[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [plate, setPlate] = useState('');
  const [gross, setGross] = useState('');
  const [destination, setDestination] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [exitTicket, setExitTicket] = useState<InternalWeighing | null>(null);

  // filters
  const [fStart, setFStart] = useState('');
  const [fEnd, setFEnd] = useState('');
  const [fEmp, setFEmp] = useState('all');
  const [fDest, setFDest] = useState('');

  const loadEmployees = useCallback(async () => {
    const { data } = await supabase
      .from('employees')
      .select('id,full_name,role_title')
      .eq('status', 'ativo')
      .order('full_name');
    setEmployees(((data as any) || []) as Employee[]);
  }, []);

  const loadPlates = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('weighings').select('vehicle_plate').not('vehicle_plate', 'is', null).limit(500),
      supabase.from('internal_weighings').select('vehicle_plate').not('vehicle_plate', 'is', null).limit(500),
    ]);
    const set = new Set<string>();
    (a.data as any[] | null)?.forEach(r => r.vehicle_plate && set.add(String(r.vehicle_plate).toUpperCase()));
    (b.data as any[] | null)?.forEach(r => r.vehicle_plate && set.add(String(r.vehicle_plate).toUpperCase()));
    setPlates(Array.from(set).sort());
  }, []);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('internal_weighings')
      .select('*,employees(full_name,role_title)')
      .order('entry_at', { ascending: false })
      .limit(500);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems(((data as any) || []) as InternalWeighing[]);
  }, []);

  useEffect(() => {
    loadEmployees();
    loadPlates();
    load();
    const ch = supabase
      .channel('internal_weighings_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_weighings' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, loadEmployees, loadPlates]);

  const submit = async () => {
    if (!employeeId || !plate || !gross) {
      toast.error('Motorista, placa e peso obrigatórios');
      return;
    }
    setBusy(true);
    const payload = {
      employee_id: employeeId,
      vehicle_plate: plate.toUpperCase(),
      gross_weight: Number(gross),
      destination: destination || null,
      notes: notes || null,
    };
    const { data, error } = await supabase.from('internal_weighings').insert(payload as any).select().single();
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message || 'Erro');
      return;
    }
    await logAudit({ table: 'internal_weighings', recordId: (data as any).id, action: 'INSERT', newValue: payload });
    toast.success('Pesagem interna registrada');
    setEmployeeId('');
    setPlate('');
    setGross('');
    setDestination('');
    setNotes('');
    load();
  };

  const open = items.filter(i => i.status === 'em_aberto');
  const finalized = useMemo(() => items.filter(i => {
    if (i.status !== 'finalizado') return false;
    if (fStart && i.entry_at.slice(0, 10) < fStart) return false;
    if (fEnd && i.entry_at.slice(0, 10) > fEnd) return false;
    if (fEmp !== 'all' && i.employee_id !== fEmp) return false;
    if (fDest && !(i.destination ?? '').toLowerCase().includes(fDest.toLowerCase())) return false;
    return true;
  }), [items, fStart, fEnd, fEmp, fDest]);

  const headers = ['ID', 'Motorista', 'Placa', 'Destino', 'Entrada', 'Saída', 'Líquido (kg)', 'Observações'];
  const rows = finalized.map(i => [
    i.id.slice(0, 8),
    i.employees?.full_name ?? '-',
    i.vehicle_plate,
    i.destination ?? '-',
    fmtDT(i.entry_at),
    i.exit_at ? fmtDT(i.exit_at) : '-',
    Number(i.net_weight || 0).toFixed(3),
    i.notes ?? '',
  ]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2"><Truck className="h-4 w-4" /> Nova Pesagem Interna</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs">Motorista</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.full_name}{e.role_title ? ` — ${e.role_title}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Placa</Label>
              <Input value={plate} list="plates-list" onChange={e => setPlate(e.target.value.toUpperCase())} className="uppercase" />
              <datalist id="plates-list">{plates.map(p => <option key={p} value={p} />)}</datalist>
            </div>
            <div>
              <Label className="text-xs">Peso Entrada (kg)</Label>
              <Input type="number" step="0.001" value={gross} onChange={e => setGross(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Destino</Label>
              <Input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Ex.: Gerdau" />
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
          <Button onClick={submit} disabled={busy} className="bg-red-600 hover:bg-red-700">
            <Plus className="h-4 w-4 mr-1" />{busy ? 'Registrando…' : 'Registrar Entrada'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-4">
          <h3 className="font-semibold text-sm mb-2">Em Aberto</h3>
          {open.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma pesagem em aberto.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">ID</TableHead>
                  <TableHead className="text-xs">Motorista</TableHead>
                  <TableHead className="text-xs">Placa</TableHead>
                  <TableHead className="text-xs">Destino</TableHead>
                  <TableHead className="text-xs">Entrada</TableHead>
                  <TableHead className="text-xs text-right">Peso</TableHead>
                  <TableHead className="text-xs">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {open.map(i => (
                  <TableRow key={i.id}>
                    <TableCell className="text-[13px] font-mono py-1.5">{i.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-[13px] py-1.5">{i.employees?.full_name ?? '-'}</TableCell>
                    <TableCell className="text-[13px] py-1.5">{i.vehicle_plate}</TableCell>
                    <TableCell className="text-[13px] py-1.5">{i.destination ?? '-'}</TableCell>
                    <TableCell className="text-xs py-1.5">{fmtDT(i.entry_at)}</TableCell>
                    <TableCell className="text-xs py-1.5 text-right">{fmtKg(i.gross_weight)}</TableCell>
                    <TableCell className="py-1.5">
                      <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700" onClick={() => setExitTicket(i)}>Registrar Saída</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
            <h3 className="font-semibold text-sm">Finalizadas</h3>
            <ExportButton filenameBase="pesagens-internas-finalizadas" headers={headers} rows={rows} disabled={finalized.length === 0} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
            <div><Label className="text-xs">Início</Label><Input type="date" value={fStart} onChange={e => setFStart(e.target.value)} /></div>
            <div><Label className="text-xs">Fim</Label><Input type="date" value={fEnd} onChange={e => setFEnd(e.target.value)} /></div>
            <div>
              <Label className="text-xs">Motorista</Label>
              <Select value={fEmp} onValueChange={setFEmp}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Destino</Label><Input value={fDest} onChange={e => setFDest(e.target.value)} placeholder="Filtrar" /></div>
          </div>
          {finalized.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum registro no filtro.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>{headers.map(h => <TableHead key={h} className="text-xs">{h}</TableHead>)}</TableRow>
                </TableHeader>
                <TableBody>
                  {finalized.map(i => (
                    <TableRow key={i.id}>
                      <TableCell className="text-[13px] font-mono py-1.5">{i.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-[13px] py-1.5">{i.employees?.full_name ?? '-'}</TableCell>
                      <TableCell className="text-[13px] py-1.5">{i.vehicle_plate}</TableCell>
                      <TableCell className="text-[13px] py-1.5">{i.destination ?? '-'}</TableCell>
                      <TableCell className="text-xs py-1.5">{fmtDT(i.entry_at)}</TableCell>
                      <TableCell className="text-xs py-1.5">{i.exit_at ? fmtDT(i.exit_at) : '-'}</TableCell>
                      <TableCell className="text-xs py-1.5 text-right font-semibold">{fmtKg(i.net_weight)}</TableCell>
                      <TableCell className="text-xs py-1.5">{i.notes ?? ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {exitTicket && (
        <InternalExitDialog ticket={exitTicket} onClose={() => setExitTicket(null)} onDone={load} />
      )}
    </div>
  );
}

function InternalExitDialog({ ticket, onClose, onDone }: { ticket: InternalWeighing; onClose: () => void; onDone: () => void }) {
  const [tare, setTare] = useState('');
  const [busy, setBusy] = useState(false);
  const liquido = (Number(ticket.gross_weight) || 0) - (Number(tare) || 0);
  const submit = async () => {
    if (!tare) {
      toast.error('Informe a tara');
      return;
    }
    setBusy(true);
    const updates = { tare_weight: Number(tare), exit_at: new Date().toISOString(), status: 'finalizado' as const };
    const { error } = await supabase.from('internal_weighings').update(updates as any).eq('id', ticket.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({ table: 'internal_weighings', recordId: ticket.id, action: 'UPDATE', oldValue: { status: ticket.status }, newValue: updates });
    toast.success('Saída registrada');
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={busy} className="bg-red-600 hover:bg-red-700">{busy ? 'Salvando…' : 'Finalizar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}