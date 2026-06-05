import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { logAudit } from './auditLog';

interface Row {
  id: string;
  entry_at: string;
  vehicle_plate: string;
  net_weight: number;
  total_amount: number;
}

export function GenerateInvoiceDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  clientName: string;
  onDone?: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const firstDay = new Date();
  firstDay.setDate(1);
  const [start, setStart] = useState(firstDay.toISOString().slice(0, 10));
  const [end, setEnd] = useState(today);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('paid_weighings')
      .select('id,entry_at,vehicle_plate,net_weight,total_amount,status,payment_status,invoice_id')
      .eq('client_id', clientId)
      .eq('type', 'cadastrada')
      .gte('entry_at', start)
      .lte('entry_at', end + 'T23:59:59')
      .is('invoice_id', null);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const filtered = ((data as any[]) || []).filter(
      r => r.status === 'finalizado' && r.payment_status === 'pago',
    );
    setRows(filtered as Row[]);
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const totalKg = rows.reduce((a, r) => a + Number(r.net_weight || 0), 0);
  const totalBRL = rows.reduce((a, r) => a + Number(r.total_amount || 0), 0);

  const emit = async () => {
    if (rows.length === 0) {
      toast.error('Sem pesagens elegíveis no período');
      return;
    }
    setSaving(true);
    const { data: inv, error } = await supabase
      .from('invoices')
      .insert({
        client_id: clientId,
        invoice_date: today,
        due_date: today,
        total_amount: totalBRL,
        observations: `Pesagem Cadastrada — ${start} a ${end}`,
        status: 'emitida',
      } as any)
      .select()
      .single();
    if (error || !inv) {
      setSaving(false);
      toast.error('Erro: ' + (error?.message || 'desconhecido'));
      return;
    }
    const items = rows.map(r => ({
      invoice_id: (inv as any).id,
      service_type: 'pesagem_cadastrada',
      document_number: r.vehicle_plate,
      item_date: r.entry_at.slice(0, 10),
      amount: Number(r.total_amount || 0),
    }));
    await supabase.from('invoice_items').insert(items as any);
    await supabase
      .from('paid_weighings')
      .update({ invoice_id: (inv as any).id } as any)
      .in('id', rows.map(r => r.id));
    await logAudit({
      table: 'invoices',
      recordId: (inv as any).id,
      action: 'INSERT',
      newValue: { client_id: clientId, period: [start, end], total: totalBRL, count: rows.length },
    });
    setSaving(false);
    toast.success('Fatura emitida');
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Gerar Faturamento — {clientName}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Início</Label>
            <Input type="date" value={start} onChange={e => setStart(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Fim</Label>
            <Input type="date" value={end} onChange={e => setEnd(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={load} variant="outline" className="w-full">Atualizar</Button>
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Data</TableHead>
                <TableHead className="text-xs">Placa</TableHead>
                <TableHead className="text-xs text-right">Líquido (kg)</TableHead>
                <TableHead className="text-xs text-right">Total (R$)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-xs">Carregando…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground">Nenhuma pesagem elegível</TableCell></TableRow>
              ) : rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{new Date(r.entry_at).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="text-xs">{r.vehicle_plate}</TableCell>
                  <TableCell className="text-xs text-right">{Number(r.net_weight).toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</TableCell>
                  <TableCell className="text-xs text-right">{Number(r.total_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-end gap-6 text-sm">
          <div>Total Peso: <span className="font-bold">{totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} kg</span></div>
          <div>Total: <span className="font-bold text-green-600">{totalBRL.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={emit} disabled={saving || rows.length === 0} className="bg-red-600 hover:bg-red-700">
            {saving ? 'Emitindo…' : 'Emitir Fatura'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}