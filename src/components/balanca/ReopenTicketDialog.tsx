import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { logAudit } from './auditLog';

const REASONS = [
  { v: 'cliente_ligou', l: 'Cliente ligou avisando' },
  { v: 'superior_liberou', l: 'Superior liberou' },
  { v: 'tolerancia', l: 'Está no tempo de tolerância' },
  { v: 'outro', l: 'Outro' },
];

export function ReopenTicketDialog({
  open,
  onOpenChange,
  ticketId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticketId: string;
  onDone?: () => void;
}) {
  const [reason, setReason] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const canConfirm = !!reason && (reason !== 'outro' || text.trim().length > 0);

  const submit = async () => {
    if (!canConfirm) return;
    setBusy(true);
    const { error: e1 } = await supabase
      .from('paid_weighings')
      .update({ status: 'reaberto' } as any)
      .eq('id', ticketId);
    if (e1) {
      setBusy(false);
      toast.error('Falha ao reabrir: ' + e1.message);
      return;
    }
    const { error: e2 } = await supabase
      .from('paid_weighing_reopenings')
      .insert({ paid_weighing_id: ticketId, reason, reason_text: text || null } as any);
    if (e2) {
      setBusy(false);
      toast.error('Falha ao registrar motivo: ' + e2.message);
      return;
    }
    await logAudit({
      table: 'paid_weighings',
      recordId: ticketId,
      action: 'UPDATE',
      newValue: { status: 'reaberto', reason, reason_text: text },
    });
    toast.success('Ticket reaberto');
    setBusy(false);
    setReason('');
    setText('');
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Motivo da Reabertura</DialogTitle>
        </DialogHeader>
        <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
          {REASONS.map(r => (
            <div key={r.v} className="flex items-center gap-2">
              <RadioGroupItem id={r.v} value={r.v} />
              <Label htmlFor={r.v} className="cursor-pointer">{r.l}</Label>
            </div>
          ))}
        </RadioGroup>
        {reason === 'outro' && (
          <div>
            <Label className="text-xs">Descreva o motivo *</Label>
            <Textarea value={text} onChange={e => setText(e.target.value)} rows={3} />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={!canConfirm || busy} className="bg-red-600 hover:bg-red-700">
            {busy ? 'Salvando…' : 'Confirmar Reabertura'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}